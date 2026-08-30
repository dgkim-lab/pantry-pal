import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addListItem, checkListItem, checkoutCart, deleteCartItemAttribute, deleteList,
  deleteListItem, deleteListItemAttribute, saveCartItemAttribute, saveListItemAttribute,
  uncartItem, updateCartItem, updateList,
} from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";

type Attribute = { attributeKey: string; value: string; valueType?: "TEXT" | "NUMBER" | "BOOLEAN" };
const aliases: Record<string, string[]> = {
  actualPrice: ["actual_price", "actualPrice", "actualprice"],
  expectedPrice: ["expected_price", "expectedPrice", "expectedprice"],
  quantity: ["quantity", "defaultQuantity", "default_quantity"],
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
            <input name="value" defaultValue={attribute.value} aria-label={attribute.attributeKey} />
            <select
              key={attribute.attributeKey + (attribute.valueType ?? "TEXT")}
              name="valueType"
              defaultValue={String(attribute.valueType ?? "TEXT").toUpperCase()}
            >
              <option>TEXT</option>
              <option>NUMBER</option>
              <option>BOOLEAN</option>
            </select>
            <div className="editable-attribute-actions">
              <button className="secondary-button">Update</button>
              <button
                formAction={cartItem ? deleteCartItemAttribute : deleteListItemAttribute}
                className="text-danger"
              >
                Delete
              </button>
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
      <SiteHeader name={session.user.name} />
      <div className="detail-wrap">
        <Link href="/lists" className="back-link">← All lists</Link>
        <div className="detail-heading">
          <div>
            <p className="eyebrow">SHOPPING LIST</p>
            <h1>{list.name}</h1>
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
            <form action={updateList} className="compact-form">
              <input type="hidden" name="listId" value={id} />
              <input name="name" defaultValue={list.name} aria-label="List name" required />
              <button className="secondary-button">Save</button>
            </form>
          </details>
          <form action={deleteList}>
            <input type="hidden" name="listId" value={id} />
            <button className="text-danger" type="submit">Delete list</button>
          </form>
        </div>

        <form action={addListItem} className="quick-add">
          <input type="hidden" name="listId" value={id} />
          <span>＋</span>
          <input name="name" list="master-items" placeholder="Add something to your list..." />
          <datalist id="master-items">
            {list.household.items.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
          <button>Add</button>
        </form>

        <div className="content-columns">
          <section className="items-panel">
            <div className="section-label"><span>TO GET</span><span>{openItems.length}</span></div>
            {openItems.map((item) => (
              <div className="item-block" key={item.id}>
                <form action={checkListItem} className="item-row">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="check-button" aria-label={"Move " + item.name + " to cart"} />
                  <div className="item-copy">
                    <strong>{item.name}</strong>
                  </div>
                </form>
                <details className="item-edit">
                  <summary>Edit attributes</summary>
                  <AttributeRows listId={id} itemId={item.id} attributes={item.attributes} />
                  <form action={saveListItemAttribute} className="attribute-form custom-attribute-form">
                    <input type="hidden" name="listId" value={id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input name="attributeKey" placeholder="Attribute" />
                    <input name="value" placeholder="Value" />
                    <select name="valueType">
                      <option>TEXT</option><option>NUMBER</option><option>BOOLEAN</option>
                    </select>
                    <button className="secondary-button">Save</button>
                  </form>
                </details>
                <form action={deleteListItem} className="item-delete-form">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="text-danger">Delete</button>
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
                <div className="item-row checked">
                  <span className="check-button checked-button">✓</span>
                  <div className="item-copy">
                    <strong>{item.name}</strong>
                  </div>
                  <form action={uncartItem}>
                    <input type="hidden" name="listId" value={id} />
                    <input type="hidden" name="cartItemId" value={item.id} />
                    <button className="uncart-button">Uncart</button>
                  </form>
                </div>
                <details className="item-edit">
                  <summary>Edit attributes</summary>
                  <AttributeRows listId={id} itemId={item.id} attributes={item.attributes} cartItem />
                  <form action={updateCartItem} className="attribute-form">
                    <input type="hidden" name="listId" value={id} />
                    <input type="hidden" name="cartItemId" value={item.id} />
                    <input name="quantity" defaultValue={attr(item.attributes, "quantity")} placeholder="Quantity" />
                    <input name="expectedPrice" defaultValue={attr(item.attributes, "expectedPrice")} placeholder="Price" />
                    <button className="secondary-button">Save</button>
                  </form>
                  <form action={saveCartItemAttribute} className="attribute-form custom-attribute-form">
                    <input type="hidden" name="listId" value={id} />
                    <input type="hidden" name="cartItemId" value={item.id} />
                    <input name="attributeKey" placeholder="Attribute" />
                    <input name="value" placeholder="Value" />
                    <select name="valueType">
                      <option>TEXT</option><option>NUMBER</option><option>BOOLEAN</option>
                    </select>
                    <button className="secondary-button">Save</button>
                  </form>
                </details>
              </div>
            ))}
          </section>

          <aside className="cart-card">
            <p className="eyebrow">ACTIVE CART</p>
            <h2>Market run <span className="cart-badge">{cartItems.length}</span></h2>
            {cartItems.length ? (
              <>
                <p className="muted">
                  Estimated total <strong>₩{total.toLocaleString("ko-KR")}</strong>
                </p>
                <form action={checkoutCart} className="stack-form">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="cartId" value={cart.id} />
                  <select name="storeId">
                    <option value="">Choose a store</option>
                    {list.household.stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                  <input type="date" name="purchasedAt" defaultValue={new Date().toISOString().slice(0, 10)} />
                  <input
                    key={total}
                    name="totalPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={total > 0 ? total.toString() : ""}
                    placeholder="Total price"
                  />
                  <textarea name="notes" placeholder="Notes" />
                  <button className="primary-button full">Checkout <span>→</span></button>
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
