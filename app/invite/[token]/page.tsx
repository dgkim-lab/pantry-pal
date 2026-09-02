import { redirect } from "next/navigation";
import { Button, Paper } from "@mui/material";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { acceptInvitation } from "@/app/actions";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await prisma.householdInvitation.findUnique({ where: { token }, include: { household: true } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) return <main className="auth-shell"><Paper className="auth-card" elevation={0}><h1>Invitation expired</h1><p className="muted">Ask the household owner to send a new invitation.</p></Paper></main>;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/invite/${token}`);
  return <main className="auth-shell"><Paper className="auth-card" elevation={0}><div className="brand-mark">PP</div><p className="eyebrow">HOUSEHOLD INVITATION</p><h1>Join {invitation.household.name}</h1><p className="muted">You were invited as an {invitation.role.toLowerCase()}.</p><form action={acceptInvitation}><input type="hidden" name="token" value={token} /><Button variant="contained" type="submit">Accept invitation</Button></form></Paper></main>;
}
