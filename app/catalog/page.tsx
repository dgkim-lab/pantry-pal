import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteMasterAttribute, deleteMasterItem, saveMasterAttribute, saveMasterItem } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";

const fields = (item?: {
  id: string;
  name: string;
}) => (
  <>
    {item && <input type="hidden" name="masterItemId" value={item.id} />}
    <input name="name" defaultValue={item?.name} placeholder="Name" required />
  </>
);

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const membership = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) redirect("/lists");

  const items = await prisma.masterItem.findMany({
    where: { householdId: membership.householdId },
    include: { attributes: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-shell">
      <SiteHeader name={session.user.name} />
      <div className="page-wrap">
        <p className="eyebrow">REUSABLE ITEMS</p>
        <h1>Catalog</h1>
        <p className="muted page-intro">
          Every item detail is a customizable attribute, copied into future list and purchase snapshots.
        </p>
        <details className="create-panel">
          <summary>＋ Add master item</summary>
          <form action={saveMasterItem} className="field-grid wide-fields">
            {fields()}
            <button className="primary-button">Create item</button>
          </form>
        </details>
        <section className="catalog-list">
          {items.map((item) => (
            <details className="catalog-item" key={item.id}>
              <summary>
                <span className="catalog-name">{item.name}</span>
                <span>{item.attributes.length} attributes</span>
              </summary>
              <form action={saveMasterItem} className="field-grid wide-fields">
                {fields(item)}
                <button className="secondary-button">Save changes</button>
              </form>
              <form action={deleteMasterItem}>
                <input type="hidden" name="masterItemId" value={item.id} />
                <button className="text-danger">Delete item</button>
              </form>
              <div className="attribute-list">
                {item.attributes.map((attribute) => (
                  <form action={saveMasterAttribute} key={attribute.id} className="attribute-row">
                    <input type="hidden" name="masterItemId" value={item.id} />
                    <input type="hidden" name="attributeKey" value={attribute.attributeKey} />
                    <span className="attribute-name">{attribute.attributeKey}</span>
                    <input name="value" defaultValue={attribute.value} aria-label={attribute.attributeKey} />
                    <select
                      key={attribute.attributeKey + attribute.valueType}
                      name="valueType"
                      defaultValue={String(attribute.valueType).toUpperCase()}
                    >
                      <option>TEXT</option>
                      <option>NUMBER</option>
                      <option>BOOLEAN</option>
                    </select>
                    <button className="secondary-button">Update</button>
                    <button formAction={deleteMasterAttribute} className="text-danger">Delete</button>
                  </form>
                ))}
              </div>
              <form action={saveMasterAttribute} className="attribute-form">
                <input type="hidden" name="masterItemId" value={item.id} />
                <input name="attributeKey" placeholder="Custom attribute" />
                <input name="value" placeholder="Value" />
                <select name="valueType">
                  <option>TEXT</option>
                  <option>NUMBER</option>
                  <option>BOOLEAN</option>
                </select>
                <button className="secondary-button">Save attribute</button>
              </form>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
