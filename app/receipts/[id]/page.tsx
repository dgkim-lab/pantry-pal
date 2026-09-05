import { notFound } from "next/navigation";
import { Button } from "@mui/material";
import { auth } from "@/auth";
import { printReceipt } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";
import { prisma } from "@/lib/prisma";

type PageContext = { params: Promise<{ id: string }> };

const aliases: Record<string, string[]> = {
  actualPrice: ["actualPrice", "actual_price", "actualprice"],
  quantity: ["quantity", "defaultQuantity", "default_quantity", "defaultquantity"],
  unit: ["unit", "defaultUnit", "default_unit", "defaultunit"],
};

function attr(attributes: { attributeKey: string; value: string }[], name: string) {
  return attributes.find((item) => (aliases[name] ?? [name]).includes(item.attributeKey))?.value;
}

export default async function ReceiptDetailPage({ params }: PageContext) {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const { id } = await params;
  const purchase = await prisma.purchase.findFirst({
    where: { id, household: { members: { some: { userId: session.user.id } } } },
    include: { household: { select: { name: true } }, store: { select: { name: true } }, items: { include: { attributes: true } } },
  });
  if (!purchase) notFound();

  return (
    <main className="app-shell">
      <SiteHeader name={session.user.name} />
      <div className="detail-wrap">
        <a className="back-link" href="/history">← Purchase history</a>
        <div className="detail-heading">
          <div>
            <p className="eyebrow">RECEIPT DETAIL</p>
            <h1>{purchase.store?.name ?? "Unassigned store"}</h1>
            <p className="muted">{purchase.purchasedAt.toLocaleString("en-KR", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <div className="receipt-actions">
            <form action={printReceipt}>
              <input type="hidden" name="purchaseId" value={purchase.id} />
              <Button type="submit" variant="contained">Print receipt</Button>
            </form>
            <Button component="a" href={`/api/purchases/${purchase.id}/receipt`} variant="outlined">Download PDF</Button>
          </div>
        </div>
        <section className="purchase-card receipt-detail-card">
          <p><strong>Receipt:</strong><br />{purchase.id}</p>
          <p><strong>Household:</strong> {purchase.household.name}</p>
          <h2>Items</h2>
          <div className="receipt-detail-items">
            {purchase.items.map((item) => {
              const quantity = attr(item.attributes, "quantity");
              const unitPrice = attr(item.attributes, "actualPrice");
              const linePrice = quantity && unitPrice && Number.isFinite(Number(quantity)) && Number.isFinite(Number(unitPrice))
                ? Number(quantity) * Number(unitPrice)
                : null;
              return (
                <div className="receipt-detail-line" key={item.id}>
                  <span>{item.name}</span>
                  <span>qty {quantity ?? "-"}</span>
                  <span>{unitPrice ? `₩${Number(unitPrice).toLocaleString("ko-KR")}` : "—"}</span>
                  <strong>{linePrice === null ? "—" : `₩${linePrice.toLocaleString("ko-KR")}`}</strong>
                </div>
              );
            })}
          </div>
          <div className="receipt-detail-total"><span>Total</span><strong>{purchase.totalPrice ? `₩${Number(purchase.totalPrice).toLocaleString("ko-KR")}` : "—"}</strong></div>
          {purchase.notes && <p className="muted"><strong>Notes:</strong> {purchase.notes}</p>}
        </section>
      </div>
    </main>
  );
}
