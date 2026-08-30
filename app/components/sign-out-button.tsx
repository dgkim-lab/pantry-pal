"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  async function handleSignOut() {
    await signOut({ redirect: false });
    const response = await fetch("/api/auth/cognito-signout-url", { cache: "no-store" });
    const { url } = (await response.json()) as { url: string };
    window.location.assign(url);
  }

  return (
    <button className="sign-out-button" type="button" onClick={handleSignOut}>
      Sign out
    </button>
  );
}
