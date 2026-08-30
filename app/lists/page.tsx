import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createList } from "@/app/actions";

export default async function ListsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const lists = await prisma.shoppingList.findMany({ where: { household: { members: { some: { userId: session.user.id } } } }, include: { _count: { select: { items: { where: { status: "OPEN" } } } } }, orderBy: { updatedAt: "desc" } });
  return <main className="app-shell"><header className="topbar"><Link href="/lists" className="wordmark"><span className="brand-mark small">PP</span> pantry pal</Link><div className="user-chip">{session.user.name?.slice(0, 1) ?? "U"}</div></header><div className="page-wrap"><div className="page-heading"><div><p className="eyebrow">YOUR HOUSEHOLD</p><h1>Shopping lists</h1></div><form action={createList} className="inline-form"><input name="name" placeholder="New list name" aria-label="New list name" /><button className="primary-button" type="submit">+ New list</button></form></div><section className="list-grid">{lists.map((list) => <Link href={`/lists/${list.id}`} className="list-card" key={list.id}><div className="list-card-top"><span className="list-icon">✦</span><span className="arrow">↗</span></div><h2>{list.name}</h2><p>{list._count.items} {list._count.items === 1 ? "item" : "items"} to get</p><div className="progress"><span style={{ width: `${list._count.items ? 20 : 0}%` }} /></div></Link>)}{lists.length === 0 && <div className="empty-state"><span>✦</span><h2>Make your first list</h2><p>Start with the things you never want to forget.</p></div>}</section></div></main>;
}
