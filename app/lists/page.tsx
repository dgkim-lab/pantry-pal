import Link from "next/link";
import { Button, Card, CardContent, LinearProgress, TextField, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/household";
import { createList } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";

export default async function ListsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const membership = await getActiveMembership();
  if (!membership) redirect("/households");
  const lists = await prisma.shoppingList.findMany({
    where: { householdId: membership.householdId },
    include: {
      items: {
        where: { status: { in: ["OPEN", "IN_CART"] } },
        select: { status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="app-shell">
      <SiteHeader name={session.user.name} />
      <div className="page-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR HOUSEHOLD</p>
            <h1>Shopping lists</h1>
          </div>
          <form action={createList} className="inline-form">
            <TextField name="name" placeholder="New list name" aria-label="New list name" />
            <Button variant="contained" type="submit">+ New list</Button>
          </form>
        </div>
        <section className="list-grid">
          {lists.map((list) => {
            const openItems = list.items.filter((item) => item.status === "OPEN").length;
            const completedItems = list.items.length - openItems;
            const progress = list.items.length ? (completedItems / list.items.length) * 100 : 0;

            return (
              <Card component={Link} href={`/lists/${list.id}`} className="list-card" key={list.id} sx={{ textDecoration: "none" }}>
              <CardContent>
                <div className="list-card-top">
                  <span className="list-icon">✦</span>
                  <span className="arrow">↗</span>
                </div>
                <Typography variant="h2" sx={{ mt: 3, mb: .5, fontSize: 20 }}>{list.name}</Typography>
                <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                {openItems} {openItems === 1 ? "item" : "items"} to get
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  color="secondary"
                  aria-label={`${completedItems} of ${list.items.length} items completed`}
                />
              </CardContent>
              </Card>
            );
          })}
          {lists.length === 0 && (
            <div className="empty-state">
              <span>✦</span>
              <h2>Make your first list</h2>
              <p>Start with the things you never want to forget.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
