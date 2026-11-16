//! "Solve with AI": run a local coding-agent CLI (Claude Code, Cursor) inside a mapped git repo and
//! stream its output to the chat UI.
//!
//! Security model (the renderer shows untrusted task HTML, so it is treated as hostile):
//! - The renderer can NOT run arbitrary programs. The binary and the flag template per solver and per
//!   permission mode are fixed HERE, in Rust. JS passes only data (which solver, prompt, repo, session, mode).
//! - Arguments are passed as a real argv array (never a shell string), so task text can't inject a command.
//! - API keys live only in the Keychain; they are read here and set as a child env var, so they never cross
//!   the JS/IPC boundary and are never logged.
//! - `git push` is never exposed by this module, and is additionally denied to the agent where the CLI
//!   supports per-tool rules (Claude). Committing is left to the agent (Full mode) or the user's own tools.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

/// Running solve processes, keyed by a run id the caller generates, so a turn can be stopped.
#[derive(Default)]
pub struct Solves(pub Mutex<HashMap<String, std::process::Child>>);

/// One line from the CLI, streamed verbatim; the TS side parses each solver's NDJSON. `exit` ends the turn.
#[derive(Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SolveEvent {
    Stdout { line: String },
    Stderr { line: String },
    Exit { code: Option<i32> },
}

/// GUI apps on macOS inherit a bare PATH, so a CLI installed in a user dir (~/.local/bin, Homebrew, bun, npm)
/// isn't found by name. Resolve to an absolute path ourselves against the usual install dirs plus the current PATH.
fn resolve_bin(name: &str) -> Option<PathBuf> {
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(h) = &home {
        for rel in [".local/bin", ".bun/bin", ".npm-global/bin", ".cargo/bin", ".deno/bin"] {
            dirs.push(h.join(rel));
        }
    }
    for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
        dirs.push(PathBuf::from(p));
    }
    if let Some(path) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    dirs.into_iter().map(|d| d.join(name)).find(|p| p.is_file())
}

/// PATH for the child so the agent's own subprocess calls (git, node) resolve, mirroring `resolve_bin`'s dirs.
fn child_path() -> String {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(h) = std::env::var_os("HOME").map(PathBuf::from) {
        for rel in [".local/bin", ".bun/bin", ".npm-global/bin", ".cargo/bin", ".deno/bin"] {
            dirs.push(h.join(rel));
        }
    }
    for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
        dirs.push(PathBuf::from(p));
    }
    if let Some(path) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    std::env::join_paths(dirs).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default()
}

/// A path is only accepted if it's an existing directory that is a git repo.
fn valid_repo(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_dir() {
        return Err("Repo path is not a folder".into());
    }
    if !p.join(".git").exists() {
        return Err("That folder is not a git repository".into());
    }
    Ok(p)
}

/// The allowlist: which binary, which Keychain account holds its optional API key + the env var it goes in.
fn solver_spec(solver: &str) -> Option<(&'static str, &'static str, &'static str)> {
    match solver {
        // (binary, keychain account, env var for the key)
        "claude" => Some(("claude", "ai:claude:apiKey", "ANTHROPIC_API_KEY")),
        _ => None,
    }
}

/// Builds the exact argv for a solver + mode. This is the security boundary: JS never supplies flags.
fn build_args(solver: &str, prompt: &str, session: &Option<String>, resume: bool, mode: &str, model: &Option<String>, effort: &Option<String>) -> Result<Vec<String>, String> {
    let s = |v: &str| v.to_string();
    // The model name is a bounded identifier (alias or id); reject anything odd rather than pass it through.
    let model = model.as_deref().filter(|m| !m.is_empty() && m.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | ':' | '_')));
    // Effort is a fixed allowlist of levels; anything else is dropped.
    let effort = effort.as_deref().filter(|e| matches!(*e, "low" | "medium" | "high" | "xhigh" | "max" | "ultracode"));
    match solver {
        "claude" => {
            let mut a = vec![s("-p"), prompt.to_string(), s("--output-format"), s("stream-json"), s("--verbose")];
            if let Some(m) = model {
                a.push(s("--model"));
                a.push(m.to_string());
            }
            if let Some(e) = effort {
                a.push(s("--effort"));
                a.push(e.to_string());
            }
            if let Some(id) = session {
                a.push(s(if resume { "--resume" } else { "--session-id" }));
                a.push(id.clone());
            }
            match mode {
                "plan" => a.extend([s("--permission-mode"), s("plan")]),
                // Edits only: apply edits automatically, but never commit or push on the agent's own.
                "edits" => a.extend([
                    s("--permission-mode"), s("acceptEdits"),
                    s("--disallowedTools"), s("Bash(git commit *)"), s("Bash(git push *)"),
                ]),
                // Full access, still never auto-push (push is the one thing that leaves the machine).
                "full" => a.extend([s("--permission-mode"), s("bypassPermissions"), s("--disallowedTools"), s("Bash(git push *)")]),
                other => return Err(format!("unknown mode {other}")),
            }
            Ok(a)
        }
        _ => Err("unknown solver".into()),
    }
}

/// Start a solve turn: spawn the CLI, stream stdout/stderr lines over `on_event`, store the child so it can be stopped.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn solve_start(
    app: AppHandle,
    run_id: String,
    solver: String,
    prompt: String,
    repo: String,
    session_id: Option<String>,
    resume: bool,
    mode: String,
    model: Option<String>,
    effort: Option<String>,
    on_event: Channel<SolveEvent>,
) -> Result<(), String> {
    let (_, account, env_var) = solver_spec(&solver).ok_or("Unknown solver")?;
    let repo_dir = valid_repo(&repo)?;
    let bin = resolve_bin(solver_spec(&solver).unwrap().0).ok_or("CLI not found on this Mac")?;
    let args = build_args(&solver, &prompt, &session_id, resume, &mode, &model, &effort)?;
    let key = get_secret_opt(&app, account);

    let mut cmd = Command::new(bin);
    cmd.args(&args)
        .current_dir(&repo_dir)
        .env("PATH", child_path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // Optional: if the user stored a key we inject it; otherwise the CLI uses its own stored login.
    if let Some(key) = key {
        cmd.env(env_var, key);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Couldn't start the CLI: {e}"))?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    app.state::<Solves>().0.lock().unwrap().insert(run_id.clone(), child);

    let err_ch = on_event.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = err_ch.send(SolveEvent::Stderr { line });
        }
    });

    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = on_event.send(SolveEvent::Stdout { line });
        }
        // stdout closed → the turn is over (also the path a kill takes). Reap the child and report the exit code.
        let code = app2
            .state::<Solves>()
            .0
            .lock()
            .unwrap()
            .remove(&run_id)
            .and_then(|mut c| c.wait().ok())
            .and_then(|st| st.code());
        let _ = on_event.send(SolveEvent::Exit { code });
    });

    Ok(())
}

/// Stop a running turn; killing it closes stdout, which makes `solve_start`'s reader reap and emit `exit`.
#[tauri::command]
pub fn solve_stop(app: AppHandle, run_id: String) {
    if let Some(child) = app.state::<Solves>().0.lock().unwrap().get_mut(&run_id) {
        let _ = child.kill();
    }
}

/// Whether a solver's CLI is installed (so the UI can offer it or show its setup guide).
#[tauri::command]
pub fn solve_cli_available(solver: String) -> bool {
    let Some((name, _, _)) = solver_spec(&solver) else { return false };
    let Some(bin) = resolve_bin(name) else { return false };
    Command::new(bin)
        .arg("--version")
        .env("PATH", child_path())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// The working-tree diff, for the user to review before committing. (Tracked changes; new files show via status.)
#[tauri::command]
pub fn solve_git_diff(repo: String) -> Result<String, String> {
    let repo = valid_repo(&repo)?;
    let git = resolve_bin("git").ok_or("git not found")?;
    let out = Command::new(git)
        .arg("-C").arg(&repo)
        .arg("diff")
        .env("PATH", child_path())
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// The repo's tracked files (honors .gitignore), for the @-mention picker. Paths are relative to the repo root.
#[tauri::command]
pub fn solve_repo_files(repo: String) -> Result<Vec<String>, String> {
    let repo = valid_repo(&repo)?;
    let git = resolve_bin("git").ok_or("git not found")?;
    let out = Command::new(git)
        .arg("-C").arg(&repo)
        .arg("ls-files")
        .env("PATH", child_path())
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    // shortcut: cap at 20k paths so a giant repo can't flood the picker; upgrade to a filtered query if that's ever hit.
    Ok(String::from_utf8_lossy(&out.stdout).lines().map(String::from).take(20_000).collect())
}

/// Keychain read that treats any error as "no key" — the key is optional, a lookup failure shouldn't block a run.
fn get_secret_opt(app: &AppHandle, account: &str) -> Option<String> {
    crate::get_secret(app, account).ok().flatten()
}

/// The CLI subcommand that starts its browser sign-in.
fn login_args(solver: &str) -> Option<Vec<String>> {
    match solver {
        "claude" => Some(vec!["auth".into(), "login".into()]),
        _ => None,
    }
}

/// Start the CLI's sign-in: it prints a URL (the UI opens it) and may redirect back to a localhost callback.
/// stdin is piped (not null) so a flow that asks for a pasted code can be fed via `solve_login_input`.
#[tauri::command]
pub async fn solve_login(app: AppHandle, run_id: String, solver: String, on_event: Channel<SolveEvent>) -> Result<(), String> {
    let (name, _, _) = solver_spec(&solver).ok_or("Unknown solver")?;
    let bin = resolve_bin(name).ok_or("CLI not found on this Mac")?;
    let args = login_args(&solver).ok_or("Unknown solver")?;

    let mut cmd = Command::new(bin);
    cmd.args(&args).env("PATH", child_path()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Couldn't start sign-in: {e}"))?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    app.state::<Solves>().0.lock().unwrap().insert(run_id.clone(), child);

    let err_ch = on_event.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = err_ch.send(SolveEvent::Stderr { line });
        }
    });
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = on_event.send(SolveEvent::Stdout { line });
        }
        let code = app2.state::<Solves>().0.lock().unwrap().remove(&run_id).and_then(|mut c| c.wait().ok()).and_then(|s| s.code());
        let _ = on_event.send(SolveEvent::Exit { code });
    });
    Ok(())
}

/// Feed a pasted code (plus newline) to a running sign-in's stdin, for flows that don't auto-redirect.
#[tauri::command]
pub fn solve_login_input(app: AppHandle, run_id: String, text: String) -> Result<(), String> {
    let state = app.state::<Solves>();
    let mut guard = state.0.lock().unwrap();
    let child = guard.get_mut(&run_id).ok_or("no sign-in running")?;
    let stdin = child.stdin.as_mut().ok_or("no stdin")?;
    stdin.write_all(text.as_bytes()).and_then(|_| stdin.write_all(b"\n")).map_err(|e| e.to_string())
}

/// Whether the solver's CLI is signed in (exit 0 from its status command).
#[tauri::command]
pub fn solve_auth_status(solver: String) -> bool {
    let Some((name, _, _)) = solver_spec(&solver) else { return false };
    let Some(bin) = resolve_bin(name) else { return false };
    let args: &[&str] = match solver.as_str() {
        "claude" => &["auth", "status"],
        _ => return false,
    };
    Command::new(bin)
        .args(args)
        .env("PATH", child_path())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
