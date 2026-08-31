import Link from "next/link";
import { Button, MenuItem, TextField } from "@mui/material";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addListItem, checkListItem, checkoutCart, deleteCartItemAttribute, deleteList,
  deleteListItem, deleteListItemAttribute, saveCartItemAttribute, saveListItemAttribute,
  uncartItem, updateCartItem, updateList,
} from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";
import { ItemCheckButton } from "@/app/components/item-check-button";
import { QuickAdd } from "@/app/components/quick-add";

type Attribute = { attributeKey: string; value: string; valueType?: "TEXT" | "NUMBER" | "BOOLEAN" };
const aliases: Record<string, string[]> = {
  actualPrice: ["actual_price", "actualPrice", "actualprice"],
  expectedPrice: ["expected_price", "expectedPrice", "expectedprice"],
  quantity: ["quantity", "defaultQuantity", "default_quantity", "defaultquantity"],
};
const attr = (items: readonly Attribute[], key: string) =>
  items.find((item) => (aliases[key] ?? [key]).includes(item.attributeKey))?.value ?? "";
const lineTotal = (attributes: readonly Attribute[]) => {
  const actualValue = attr(attributes, "actualPrice");
  const actual = Number(actualValue);
  const expectedValue = attr(attributes, "expectedPrice");
  const expected = Number(expectedValue);
  const price = actualValue && Number.isFinite(actual) && actual >= 0
    ? actual
    : expectedValue && Number.isFinite(expected) && expected >= 0
      ? expected
      : 0;
  const quantity = Number(attr(attributes, "quantity"));
  return (Number.isFinite(price) ? price : 0) *
    (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
};

function ItemMeta({ attributes }: { attributes: Attribute[] }) {
  const quantity = attr(attributes, "quantity");
  const actualPrice = attr(attributes, "actualPrice");
  const expectedPrice = attr(attributes, "expectedPrice");
  const price = actualPrice || expectedPrice;

  if (!quantity && !price) return null;

  return (
    <span className="item-meta">
      {quantity ? `Qty ${quantity}` : ""}
      {quantity && price ? " · " : ""}
      {price && (
        <span className={actualPrice ? "item-price" : "item-price expected-price"}>
          ₩{Number(price).toLocaleString("ko-KR")}
        </span>
      )}
    </span>
  );
}

function AttributeRows({
  attributes,
  listId,
  itemId,
  cartItem,
}: {
  attributes: Attribute[];
  listId: string;
  itemId: string;
  cartItem?: boolean;
}) {
  return (
    <div className="attribute-list">
      {attributes.map((attribute) => (
        <div className="editable-attribute-row" key={attribute.attributeKey}>
          <span className="attribute-name">{attribute.attributeKey}</span>
          <form action={cartItem ? saveCartItemAttribute : saveListItemAttribute}>
            <input type="hidden" name="listId" value={listId} />
            <input type="hidden" name={cartItem ? "cartItemId" : "itemId"} value={itemId} />
            <input type="hidden" name="attributeKey" value={attribute.attributeKey} />
            <TextField
              name="value"
              defaultValue={attribute.value}
              type={attribute.valueType === "NUMBER" ? "number" : undefined}
              slotProps={attribute.valueType === "NUMBER" ? { htmlInput: { inputMode: "decimal" } } : undefined}
              aria-label={attribute.attributeKey}
            />
            <TextField
              select
              key={attribute.attributeKey + (attribute.valueType ?? "TEXT")}
              name="valueType"
              label="Type"
              defaultValue={String(attribute.valueType ?? "TEXT").toUpperCase()}
            >
              <MenuItem value="TEXT">TEXT</MenuItem>
              <MenuItem value="NUMBER">NUMBER</MenuItem>
              <MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
            </TextField>
            <div className="editable-attribute-actions">
              <Button variant="outlined" type="submit">Update</Button>
              <Button
                formAction={cartItem ? deleteCartItemAttribute : deleteListItemAttribute}
                color="error"
                type="submit"
              >
                Delete
              </Button>
            </div>
          </form>
        </div>
      ))}
    </div>
  );
}

export default async function ListDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { id } = await params;
  const list = await prisma.shoppingList.findFirst({
    where: { id, household: { members: { some: { userId: session.user.id } } } },
    include: {
      items: {
        where: { status: { in: ["OPEN", "IN_CART"] } },
        include: { attributes: true },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
      carts: {
        where: { status: "ACTIVE" },
        include: { items: { include: { attributes: true } } },
        take: 1,
      },
      household: {
        include: { items: true, stores: { orderBy: { name: "asc" } } },
      },
    },
  });
  if (!list) notFound();

  const openItems = list.items.filter((item) => item.status === "OPEN");
  const cart = list.carts[0];
  const cartItems = cart?.items ?? [];
  const total = cartItems.reduce((sum, item) => sum + lineTotal(item.attributes), 0);

  return (
    <main className="app-shell">
      <SiteHeader name={session.user.name} listTitle={list.name} />
      <div className="detail-wrap">
        <Link href="/lists" className="back-link">← All lists</Link>
        <div className="detail-heading">
          <div>
            <p className="eyebrow">SHOPPING LIST</p>
            <h1 id="shopping-list-heading">{list.name}</h1>
            <p className="muted">{openItems.length} things left to pick up</p>
          </div>
          <div className="list-stats">
            <strong>{cartItems.length}</strong>
            <span>in cart</span>
          </div>
        </div>
        <div className="list-actions">
          <details>
            <summary>Edit list</summary>
            <form action={updateList} className="compact-form list-edit-form">
              <input type="hidden" name="listId" value={id} />
              <TextField fullWidth name="name" defaultValue={list.name} label="List name" required />
              <TextField fullWidth select name="defaultStoreId" label="Default store" defaultValue={list.defaultStoreId ?? ""}>
                <MenuItem value="">No default store</MenuItem>
                {list.household.stores.map((store) => (
                  <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" type="submit">Save</Button>
              <Button formAction={deleteList} variant="outlined" color="error" type="submit">Delete</Button>
            </form>
          </details>
        </div>

        <QuickAdd listId={id} items={list.household.items} />

        <div className="content-columns">
          <section className="items-panel">
            <div className="section-label"><span>TO GET</span><span>{openItems.length}</span></div>
            {openItems.map((item) => (
              <div className="item-block" key={item.id}>
                <form action={checkListItem} className="item-row">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <ItemCheckButton checked={false} label={"Move " + item.name + " to cart"} />
                  <div className="item-copy">
                    <strong>{item.name}</strong>
                    <ItemMeta attributes={item.attributes} />
                  </div>
                </form>
                <details className="item-edit">
                  <summary>Edit attributes</summary>
                  <AttributeRows listId={id} itemId={item.id} attributes={item.attributes} />
                  <form action={saveListItemAttribute} className="attribute-form custom-attribute-form">
                    <input type="hidden" name="listId" value={id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <TextField name="attributeKey" placeholder="Attribute" label="Attribute" />
                    <TextField name="value" placeholder="Value" label="Value" />
                    <TextField select name="valueType" label="Type" defaultValue="TEXT">
                      <MenuItem value="TEXT">TEXT</MenuItem><MenuItem value="NUMBER">NUMBER</MenuItem><MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
                    </TextField>
                    <Button variant="outlined" type="submit">Save</Button>
                  </form>
                </details>
                <form action={deleteListItem} className="item-delete-form">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <Button color="error" type="submit">Delete</Button>
                </form>
              </div>
            ))}
            {openItems.length === 0 && (
              <div className="panel-empty">Everything is in the cart. Nice work.</div>
            )}
            <div className="section-label completed-label">
              <span>IN CART</span><span>{cartItems.length}</span>
            </div>
            {cartItems.map((item) => (
              <div className="item-block" key={item.id}>
                <form action={uncartItem} className="item-row checked">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="cartItemId" value={item.id} />
                  <ItemCheckButton checked label={"Remove " + item.name + " from cart"} />
                  <div className="item-copy">
                    <strong>{item.name}</strong>
                    <ItemMeta attributes={item.attributes} />
                  </div>
                </form>
                <details className="item-edit">
                  <summary>Edit attributes</summary>
                  <AttributeRows listId={id} itemId={item.id} attributes={item.attributes} cartItem />
                  <form action={saveCartItemAttribute} className="attribute-form custom-attribute-form">
                    <input type="hidden" name="listId" value={id} />
                    <input type="hidden" name="cartItemId" value={item.id} />
                  <TextField name="attributeKey" placeholder="Attribute" label="Attribute" />
                  <TextField name="value" placeholder="Value" label="Value" />
                  <TextField select name="valueType" label="Type" defaultValue="TEXT">
                    <MenuItem value="TEXT">TEXT</MenuItem><MenuItem value="NUMBER">NUMBER</MenuItem><MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
                  </TextField>
                  <Button variant="outlined" type="submit">Save</Button>
                  </form>
                  <hr className="item-edit-divider" />
                  <form
                    key={`${item.id}-${attr(item.attributes, "quantity")}-${attr(item.attributes, "actualPrice")}`}
                    action={updateCartItem}
                    className="attribute-form"
                  >
                    <input type="hidden" name="listId" value={id} />
                    <input type="hidden" name="cartItemId" value={item.id} />
                    <TextField
                      name="quantity"
                      type="number"
                      defaultValue={attr(item.attributes, "quantity")}
                      placeholder="Quantity"
                      label="Quantity"
                      slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: 0.01 } }}
                    />
                    <TextField
                      name="actualPrice"
                      type="number"
                      defaultValue={attr(item.attributes, "actualPrice")}
                      placeholder="Price"
                      label="Actual price"
                      slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: 0.01 } }}
                    />
                    <Button variant="outlined" type="submit">Save</Button>
                  </form>
                </details>
              </div>
            ))}
          </section>

          <aside className="cart-card">
            <p className="eyebrow">ACTIVE CART</p>
            {cartItems.length ? (
              <>
                <form action={checkoutCart} className="stack-form">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="cartId" value={cart.id} />
                  <TextField select name="storeId" label="Store" defaultValue={cart.storeId ?? ""}>
                    <MenuItem value="">Choose a store</MenuItem>
                    {list.household.stores.map((store) => (
                      <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField type="date" name="purchasedAt" label="Purchased at" defaultValue={new Date().toISOString().slice(0, 10)} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField
                    key={total}
                    name="totalPrice"
                    type="number"
                    label="Total price"
                    defaultValue={total > 0 ? total.toString() : ""}
                    placeholder="Total price"
                    slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: 0.01 } }}
                  />
                  <TextField name="notes" placeholder="Notes" label="Notes" multiline minRows={2} />
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    type="submit"
                    sx={{ mt: 1 }}
                  >
                    Checkout <span>→</span>
                  </Button>
                </form>
              </>
            ) : (
              <div className="cart-empty">
                <span>🛒</span><p>Check an item to start your cart.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
