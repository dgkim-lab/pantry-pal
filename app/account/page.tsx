import { redirect } from "next/navigation";
import { Paper, Typography } from "@mui/material";
import { auth } from "@/auth";
import { SignOutButton } from "@/app/components/sign-out-button";
import { SiteHeader } from "@/app/components/site-header";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return <main className="app-shell"><SiteHeader name={session.user.name} /><div className="page-wrap"><p className="eyebrow">ACCOUNT</p><h1>Your profile</h1><Paper sx={{ p: 3, maxWidth: 560 }}><Typography variant="h2" sx={{ fontSize: 22, mb: 1 }}>{session.user.name || "Pantry Pal member"}</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>{session.user.email}</Typography><SignOutButton /></Paper></div></main>;
}
