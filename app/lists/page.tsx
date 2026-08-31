import Link from "next/link";
import { Button, Card, CardContent, LinearProgress, TextField, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createList } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";

export default async function ListsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const lists = await prisma.shoppingList.findMany({
    where: { household: { members: { some: { userId: session.user.id } } } },
    include: { _count: { select: { items: { where: { status: "OPEN" } } } } },
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
          {lists.map((list) => (
            <Card component={Link} href={`/lists/${list.id}`} className="list-card" key={list.id} sx={{ textDecoration: "none" }}>
              <CardContent>
                <div className="list-card-top">
                  <span className="list-icon">✦</span>
                  <span className="arrow">↗</span>
                </div>
                <Typography variant="h2" sx={{ mt: 3, mb: .5, fontSize: 20 }}>{list.name}</Typography>
                <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                {list._count.items} {list._count.items === 1 ? "item" : "items"} to get
                </Typography>
                <LinearProgress variant="determinate" value={list._count.items ? 20 : 0} color="secondary" />
              </CardContent>
            </Card>
          ))}
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
