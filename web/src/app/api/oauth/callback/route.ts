import { getProvider } from "@mytask/core";
import { NextResponse, type NextRequest } from "next/server";

import { BoardLimitError } from "@/server/boards";
import { providerFetch } from "@/server/provider-fetch";
import { clearPending, saveSignedIn, takePending } from "@/server/sign-in";

/**
 * Closes a sign-in that ran in a popup: tells the page that opened it (same origin only) and closes. The message holds
 * a result code, nothing else.
 */
function closePopup(result: { ok: true } | { error: string }) {
  const message = JSON.stringify({ type: "atm:sign-in", ...result });
  const html = `<!doctype html><meta charset="utf-8"><title>AssignedToMe</title><script>
try { window.opener && window.opener.postMessage(${message}, location.origin); } catch (e) {}
window.close();
</script>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Where the consent page sends the browser back. `finish` checks the state against the one kept for this browser. */
export async function GET(request: NextRequest) {
  const started = await takePending();
  const provider = started && getProvider(started.providerId);
  if (!started || provider?.signIn?.kind !== "redirect")
    return NextResponse.redirect(new URL("/app/connect?error=signin", request.url));
  try {
    const boards = await provider.signIn.finish(providerFetch, started.pending, request.url);
    await saveSignedIn(started.providerId, boards);
    await clearPending();
    return started.popup
      ? closePopup({ ok: true })
      : NextResponse.redirect(new URL("/app", request.url));
  } catch (error) {
    await clearPending();
    const code = error instanceof BoardLimitError ? "limit" : "signin";
    return started.popup
      ? closePopup({ error: code })
      : NextResponse.redirect(
          new URL(`/app/connect/${provider.signIn.for}?error=${code}`, request.url),
        );
  }
}
