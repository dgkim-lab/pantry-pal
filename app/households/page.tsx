import { redirect } from "next/navigation";
import { Button, MenuItem, TextField } from "@mui/material";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/household";
import { acceptInvitation, createHousehold, inviteMember, removeMember, switchHousehold, updateMemberRole } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";

export default async function HouseholdsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const active = await getActiveMembership();
  const memberships = await prisma.householdMember.findMany({ where: { userId: session.user.id }, include: { household: true }, orderBy: { createdAt: "asc" } });
  if (!active && memberships.length) redirect("/lists");
  const members = active ? await prisma.householdMember.findMany({ where: { householdId: active.householdId }, include: { user: true }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] }) : [];
  const [invitations, receivedInvitations] = await Promise.all([
    active && active.role === "OWNER" ? prisma.householdInvitation.findMany({ where: { householdId: active.householdId, acceptedAt: null }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    session.user.email ? prisma.householdInvitation.findMany({ where: { email: session.user.email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } }, include: { household: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);

  return <main className="app-shell"><SiteHeader name={session.user.name} /><div className="page-wrap">
    <p className="eyebrow">YOUR WORKSPACES</p><h1>Households</h1>
    <section className="household-switcher">
      {memberships.map(({ household, householdId }) => <form action={switchHousehold} key={householdId}><input type="hidden" name="householdId" value={householdId} /><Button variant={active?.householdId === householdId ? "contained" : "outlined"} type="submit">{household.name}</Button></form>)}
      <details><summary>＋ New household</summary><form action={createHousehold} className="compact-form"><TextField name="name" label="Household name" required size="small" /><Button type="submit" variant="contained">Create</Button></form></details>
    </section>
    {receivedInvitations.length > 0 && <><h2>Invitations for you</h2><section className="invitation-cards">{receivedInvitations.map((invitation) => <article className="invitation-card" key={invitation.id}><div><strong>{invitation.household.name}</strong><span>Invited as an {invitation.role.toLowerCase()} · expires {invitation.expiresAt.toLocaleDateString("en-KR", { dateStyle: "medium" })}</span></div><form action={acceptInvitation}><input type="hidden" name="token" value={invitation.token} /><Button variant="contained" type="submit">Accept invitation</Button></form></article>)}</section></>}
    {active ? <>
      <h2>Members</h2><p className="muted">Owners manage members. Editors can change lists, stores, catalog items, and purchases. Viewers have read-only access.</p>
      <section className="member-list">{members.map((member) => <article className="member-row" key={member.id}><div><strong>{member.user.name || member.user.email}</strong><span>{member.user.email}</span></div><form action={updateMemberRole}><input type="hidden" name="memberId" value={member.id} /><TextField select name="role" defaultValue={member.role} size="small" disabled={member.userId === session.user.id}><MenuItem value="OWNER">Owner</MenuItem><MenuItem value="EDITOR">Editor</MenuItem><MenuItem value="VIEWER">Viewer</MenuItem></TextField><Button type="submit" variant="outlined" disabled={member.userId === session.user.id}>Save</Button></form>{member.userId !== session.user.id && <form action={removeMember}><input type="hidden" name="memberId" value={member.id} /><Button color="error" type="submit">Remove</Button></form>}</article>)}</section>
      {active.role === "OWNER" && <><h2>Invite someone</h2><form action={inviteMember} className="invite-form"><TextField name="email" type="email" label="Email address" required /><TextField select name="role" label="Role" defaultValue="EDITOR"><MenuItem value="EDITOR">Editor</MenuItem><MenuItem value="VIEWER">Viewer</MenuItem></TextField><Button type="submit" variant="contained">Create invitation</Button></form><p className="muted">Share a pending invitation link with the recipient. Invitations expire after seven days.</p><section className="invitation-list">{invitations.map((invitation) => <div key={invitation.id}><span>{invitation.email} · {invitation.role.toLowerCase()}</span><code>{`/invite/${invitation.token}`}</code></div>)}</section></>}
    </> : <div className="empty-state"><h2>Create your first household</h2><p>Households keep lists and purchase history private to their members.</p></div>}
  </div></main>;
}
