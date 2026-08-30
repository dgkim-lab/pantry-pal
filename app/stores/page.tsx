import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createStore, deleteStore, updateStore } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";

export default async function StoresPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const membership = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) redirect("/lists");

  const stores = await prisma.store.findMany({
    where: { householdId: membership.householdId },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-shell">
      <SiteHeader name={session.user.name} />
      <div className="page-wrap">
        <p className="eyebrow">WHERE YOU SHOP</p>
        <h1>Stores</h1>
        <details className="create-panel">
          <summary>＋ Add store</summary>
          <form action={createStore} className="field-grid wide-fields">
            <input name="name" placeholder="Store name" required />
            <select name="type" defaultValue="LOCAL">
              <option value="LOCAL">Local market</option>
              <option value="ONLINE">Online market</option>
            </select>
            <input name="address" placeholder="Address" />
            <input name="url" placeholder="Website" type="url" />
            <input name="notes" placeholder="Notes" />
            <button className="primary-button">Create store</button>
          </form>
        </details>
        <section className="catalog-list">
          {stores.map((store) => (
            <details className="catalog-item" key={store.id}>
              <summary>
                <span className="catalog-name">{store.name}</span>
                <span>{store.type === "ONLINE" ? "Online" : "Local"}</span>
              </summary>
              <form action={updateStore} className="field-grid wide-fields">
                <input type="hidden" name="storeId" value={store.id} />
                <input name="name" defaultValue={store.name} required />
                <select name="type" defaultValue={store.type}>
                  <option value="LOCAL">Local market</option>
                  <option value="ONLINE">Online market</option>
                </select>
                <input name="address" defaultValue={store.address ?? ""} placeholder="Address" />
                <input name="url" defaultValue={store.url ?? ""} placeholder="Website" type="url" />
                <input name="notes" defaultValue={store.notes ?? ""} placeholder="Notes" />
                <button className="secondary-button">Save changes</button>
              </form>
              <form action={deleteStore}>
                <input type="hidden" name="storeId" value={store.id} />
                <button className="text-danger">Delete store</button>
              </form>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
