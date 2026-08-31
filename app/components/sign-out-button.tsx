"use client";

import { signOut } from "next-auth/react";
import { Button } from "@mui/material";

export function SignOutButton() {
  async function handleSignOut() {
    await signOut({ redirect: false });
    const response = await fetch("/api/auth/cognito-signout-url", { cache: "no-store" });
    const { url } = (await response.json()) as { url: string };
    window.location.assign(url);
  }

  return (
    <Button color="inherit" size="small" type="button" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
