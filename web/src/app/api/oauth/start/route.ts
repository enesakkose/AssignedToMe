import { isSafeUrl, signInProviders } from "@mytask/core";
import { NextResponse, type NextRequest } from "next/server";

import { appOrigin } from "@/server/env";
import { providerFetch } from "@/server/provider-fetch";
import { setPending } from "@/server/sign-in";

/** Starts a browser sign-in (Atlassian, Linear): registers the client, keeps the PKCE verifier and state, goes to the consent page. */
export async function GET(request: NextRequest) {
  const provider = signInProviders.find(
    (p) => p.id === request.nextUrl.searchParams.get("provider"),
  );
  if (provider?.signIn?.kind !== "redirect")
    return NextResponse.redirect(new URL("/app/connect", request.url));
  try {
    const redirectUri = `${appOrigin(request.nextUrl.origin)}/api/oauth/callback`;
    const { url, pending } = await provider.signIn.begin(providerFetch, redirectUri);
    if (!isSafeUrl(url) || !url.startsWith("https:")) throw new Error("Unexpected sign-in page");
    await setPending(provider.id, pending, request.nextUrl.searchParams.get("popup") === "1");
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(
      new URL(`/app/connect/${provider.signIn.for}?error=signin`, request.url),
    );
  }
}
