import { redirect } from "next/navigation";
import { Button, MenuItem, TextField } from "@mui/material";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buyAgain } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";
import { getActiveMembership } from "@/lib/household";
import { PurchaseDeleteButton } from "@/app/components/purchase-delete-button";

const attributeAliases: Record<string, string[]> = {
  actualPrice: ["actual_price", "actualPrice", "actualprice"],
  quantity: ["quantity", "default_quantity", "defaultQuantity", "defaultquantity"],
  unit: ["unit", "default_unit", "defaultUnit", "defaultunit"],
};

const attr = (
  items: readonly { attributeKey: string; value: string }[],
  key: string,
) => items.find((item) => (attributeAliases[key] ?? [key]).includes(item.attributeKey))?.value ?? "";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const membership = await getActiveMembership();
  if (!membership) redirect("/households");

  const [purchases, lists] = await Promise.all([
    prisma.purchase.findMany({
      where: { householdId: membership.householdId },
      include: { store: true, items: { include: { attributes: true } } },
      orderBy: { purchasedAt: "desc" },
    }),
    prisma.shoppingList.findMany({
      where: { householdId: membership.householdId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <main className="app-shell">
      <SiteHeader name={session.user.name} />
      <div className="page-wrap">
        <p className="eyebrow">WHAT YOU BOUGHT</p>
        <h1>Purchase history</h1>
        <p className="muted page-intro">
          Purchase snapshots remain unchanged when catalog attributes are edited.
        </p>
        <section className="history-list">
          {purchases.map((purchase) => (
            <article className="purchase-card" key={purchase.id}>
              <div className="purchase-heading">
                <div>
                  <strong>{purchase.store?.name ?? "Unassigned store"}</strong>
                  <span>
                    {purchase.purchasedAt.toLocaleDateString("en-KR", {
                      dateStyle: "medium",
                    })}
                  </span>
                </div>
                <b>
                  {purchase.totalPrice
                    ? "₩" + Number(purchase.totalPrice).toLocaleString("ko-KR")
                    : "—"}
                </b>
                <Button
                  component="a"
                  href={`/receipts/${purchase.id}`}
                  variant="outlined"
                  size="small"
                >
                  View receipt
                </Button>
                <PurchaseDeleteButton purchaseId={purchase.id} />
              </div>
              <div className="purchase-items">
                {purchase.items.map((item) => (
                  <div className="purchase-line" key={item.id}>
                    <span>
                      {item.name}
                      {attr(item.attributes, "quantity")
                        ? " · " + attr(item.attributes, "quantity") + " " + attr(item.attributes, "unit")
                        : ""}
                    </span>
                    <span>
                      {attr(item.attributes, "actualPrice")
                        ? "₩" + attr(item.attributes, "actualPrice")
                        : ""}
                    </span>
                    <form action={buyAgain}>
                      <input type="hidden" name="purchaseItemId" value={item.id} />
                      <label className="buy-again-label">
                        Add to
                        <TextField select name="listId" defaultValue={lists[0]?.id ?? ""} label="Add to" size="small">
                          <MenuItem value="">list…</MenuItem>
                          {lists.map((list) => (
                            <MenuItem key={list.id} value={list.id}>
                              {list.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </label>
                      <Button variant="outlined" size="small" type="submit">Buy again</Button>
                    </form>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {purchases.length === 0 && (
            <div className="empty-state">
              <span>✦</span>
              <h2>No purchases yet</h2>
              <p>Checked-out carts will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
