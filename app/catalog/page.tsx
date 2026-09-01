import Link from "next/link";
import { Button, MenuItem, TextField } from "@mui/material";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteMasterAttribute, deleteMasterItem, saveMasterAttribute, saveMasterItem } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";
import { CatalogCheckbox, CatalogSelection } from "@/app/components/catalog-selection";

const fields = (item?: {
  id: string;
  name: string;
}) => (
  <>
    {item && <input type="hidden" name="masterItemId" value={item.id} />}
    <TextField name="name" defaultValue={item?.name} placeholder="Name" label="Name" required />
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
  const lists = await prisma.shoppingList.findMany({
    where: { householdId: membership.householdId },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
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
            <Button variant="contained" type="submit">Create item</Button>
          </form>
        </details>
        <CatalogSelection items={items.map(({ id, name }) => ({ id, name }))} lists={lists}>
          <section className="catalog-list">
            {items.map((item) => (
              <details className="catalog-item" key={item.id}>
              <summary>
                <CatalogCheckbox item={item} />
                <span className="catalog-name">{item.name}</span>
                <span
                  className="catalog-attributes catalog-attributes-full"
                  title={item.attributes.map((attribute) => `${attribute.attributeKey}: ${attribute.value}`).join(" · ") || "No attributes"}
                >
                  {item.attributes.map((attribute) => `${attribute.attributeKey}: ${attribute.value}`).join(" · ") || "No attributes"}
                </span>
                <span className="catalog-attributes catalog-attributes-count">
                  {item.attributes.length} {item.attributes.length === 1 ? "attribute" : "attributes"}
                </span>
              </summary>
              <form action={saveMasterItem} className="field-grid wide-fields">
                {fields(item)}
                <Button variant="outlined" type="submit">Save changes</Button>
              </form>
              <form action={deleteMasterItem}>
                <input type="hidden" name="masterItemId" value={item.id} />
                <Button color="error" type="submit">Delete item</Button>
              </form>
              <div className="attribute-list">
                {item.attributes.map((attribute) => (
                  <form action={saveMasterAttribute} key={attribute.id} className="editable-attribute-row">
                    <input type="hidden" name="masterItemId" value={item.id} />
                    <input type="hidden" name="attributeKey" value={attribute.attributeKey} />
                    <span className="attribute-name">{attribute.attributeKey}</span>
                    <TextField
                      name="value"
                      defaultValue={attribute.value}
                      type={attribute.valueType === "NUMBER" ? "number" : undefined}
                      slotProps={attribute.valueType === "NUMBER" ? { htmlInput: { inputMode: "decimal" } } : undefined}
                      aria-label={attribute.attributeKey}
                    />
                    <TextField
                      select
                      key={attribute.attributeKey + attribute.valueType}
                      name="valueType"
                      label="Type"
                      defaultValue={String(attribute.valueType).toUpperCase()}
                    >
                      <MenuItem value="TEXT">TEXT</MenuItem>
                      <MenuItem value="NUMBER">NUMBER</MenuItem>
                      <MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
                    </TextField>
                    <div className="editable-attribute-actions">
                      <Button variant="outlined" type="submit">Update</Button>
                      <Button formAction={deleteMasterAttribute} color="error" type="submit">Delete</Button>
                    </div>
                  </form>
                ))}
              </div>
              <hr className="attribute-divider" />
              <form action={saveMasterAttribute} className="attribute-form custom-attribute-form">
                <input type="hidden" name="masterItemId" value={item.id} />
                <TextField name="attributeKey" placeholder="Custom attribute" label="Attribute" />
                <TextField name="value" placeholder="Value" label="Value" />
                <TextField select name="valueType" label="Type" defaultValue="TEXT">
                  <MenuItem value="TEXT">TEXT</MenuItem>
                  <MenuItem value="NUMBER">NUMBER</MenuItem>
                  <MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
                </TextField>
                <Button variant="outlined" type="submit">Save attribute</Button>
              </form>
              </details>
            ))}
          </section>
        </CatalogSelection>
      </div>
    </main>
  );
}
