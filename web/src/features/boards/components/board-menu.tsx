"use client";

import { getProvider } from "@mytask/core";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useQueryClient } from "@tanstack/react-query";
import { Ellipsis, KeyRound, LogIn, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import { removeBoardAction, renameBoard } from "@/features/connections/actions";

/**
 * The open board's options: rename its tab, fix its connection (a new token, or signing in again for a board that
 * came from a sign-in), or remove it. Removing asks first; it deletes the sign-in from this browser only.
 */
export function BoardMenu({
  id,
  name,
  app,
  providerId,
}: {
  id: string;
  name: string;
  app: string;
  providerId: string;
}) {
  const t = useTranslations("queue");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [removing, setRemoving] = useState(false);
  const signIn = getProvider(providerId)?.signIn;
  const remove = () =>
    startTransition(async () => {
      await removeBoardAction(id);
      queryClient.removeQueries({ queryKey: ["tasks", id] });
      setRemoving(false);
      router.push("/app");
      router.refresh();
    });
  const rename = () =>
    startTransition(async () => {
      if ("ok" in (await renameBoard(id, draft))) {
        setRenaming(false);
        toast.success(t("renamed"));
        router.refresh();
      }
    });
  return (
    <>
      <BaseMenu.Root>
        <BaseMenu.Trigger
          aria-label={t("boardMenu")}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Ellipsis aria-hidden />
        </BaseMenu.Trigger>
        <MenuContent align="start" className="w-52">
          <MenuItem
            icon={<Pencil />}
            onClick={() => {
              setDraft(name);
              setRenaming(true);
            }}
          >
            {t("rename")}
          </MenuItem>
          {signIn ? (
            <MenuItem icon={<LogIn />} render={<Link href={`/app/connect/${signIn.for}`} />}>
              {t("signInAgain")}
            </MenuItem>
          ) : (
            <MenuItem
              icon={<KeyRound />}
              render={<Link href={`/app/connect/${providerId}?board=${id}`} />}
            >
              {t("editConnection")}
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 />}
            onClick={() => setRemoving(true)}
            className="text-error [&_svg]:text-error"
          >
            {t("removeBoard")}
          </MenuItem>
        </MenuContent>
      </BaseMenu.Root>
      <Dialog
        open={removing}
        onOpenChange={setRemoving}
        title={t("removeTitle", { board: name })}
        description={t("removeConfirm", { board: name, app })}
        closeLabel={t("cancel")}
        footer={
          <>
            <Button type="button" onClick={() => setRemoving(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={remove}
              className="text-error"
            >
              {t("removeBoard")}
            </Button>
          </>
        }
      />
      <Dialog
        open={renaming}
        onOpenChange={setRenaming}
        title={t("renameTitle")}
        closeLabel={t("cancel")}
        footer={
          <>
            <Button type="button" onClick={() => setRenaming(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="rename-board"
              variant="primary"
              disabled={pending || !draft.trim()}
            >
              {t("save")}
            </Button>
          </>
        }
      >
        <form
          id="rename-board"
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-2">{t("renameLabel")}</span>
            <Input
              autoFocus
              maxLength={80}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
        </form>
      </Dialog>
    </>
  );
}
