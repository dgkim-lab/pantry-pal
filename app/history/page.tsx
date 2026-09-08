import { redirect } from "next/navigation";
import { Button } from "@mui/material";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/app/components/site-header";
import { getActiveMembership } from "@/lib/household";
import { PurchaseDeleteButton } from "@/app/components/purchase-delete-button";
import { PurchaseCheckbox, PurchaseSelection } from "@/app/components/purchase-selection";

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
        <PurchaseSelection
          items={purchases.flatMap((purchase) => purchase.items.map((item) => ({ id: item.id, name: item.name })))}
          lists={lists}
        >
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
                      <PurchaseCheckbox item={{ id: item.id, name: item.name }} />
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
        </PurchaseSelection>
      </div>
    </main>
  );
}
