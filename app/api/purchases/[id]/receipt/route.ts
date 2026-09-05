import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPurchaseReceiptPdf } from "@/lib/purchase-receipt-pdf";

type RouteContext = { params: Promise<{ id: string }> };

const aliases: Record<string, string[]> = {
  actualPrice: ["actualPrice", "actual_price", "actualprice"],
  quantity: ["quantity", "defaultQuantity", "default_quantity", "defaultquantity"],
  unit: ["unit", "defaultUnit", "default_unit", "defaultunit"],
};

function attributeValue(attributes: { attributeKey: string; value: string }[], name: string) {
  return attributes.find((attribute) => (aliases[name] ?? [name]).includes(attribute.attributeKey))?.value;
}

export async function GET(_request: Request, context: RouteContext) {
  const internalToken = process.env.RECEIPT_INTERNAL_TOKEN;
  const authorization = _request.headers.get("authorization");
  const isInternalRequest = Boolean(internalToken && authorization === `Bearer ${internalToken}`);
  const session = isInternalRequest ? null : await auth();
  if (!isInternalRequest && !session?.user?.id) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await context.params;
  const purchase = await prisma.purchase.findFirst({
    where: isInternalRequest
      ? { id }
      : { id, household: { members: { some: { userId: session!.user!.id } } } },
    include: { household: { select: { name: true } }, store: { select: { name: true } }, items: { include: { attributes: true } } },
  });
  if (!purchase) return Response.json({ error: "Purchase not found" }, { status: 404 });

  const receipt = {
    id: purchase.id,
    householdName: purchase.household.name,
    storeName: purchase.store?.name ?? "Unassigned store",
    purchasedAt: purchase.purchasedAt.toISOString(),
    currency: purchase.currency,
    totalPrice: purchase.totalPrice?.toString() ?? null,
    notes: purchase.notes,
    items: purchase.items.map((item) => {
      const quantity = attributeValue(item.attributes, "quantity");
      const unitPrice = attributeValue(item.attributes, "actualPrice");
      const quantityNumber = quantity === undefined ? NaN : Number(quantity);
      const unitPriceNumber = unitPrice === undefined ? NaN : Number(unitPrice);
      return {
        name: item.name,
        quantity,
        unit: attributeValue(item.attributes, "unit"),
        unitPrice,
        price: Number.isFinite(quantityNumber) && Number.isFinite(unitPriceNumber)
          ? String(quantityNumber * unitPriceNumber)
          : unitPrice,
      };
    }),
  };

  if (_request.headers.get("accept")?.includes("application/json")) {
    return Response.json(receipt, { headers: { "Cache-Control": "private, no-store" } });
  }

  const pdf = createPurchaseReceiptPdf({
    id: receipt.id,
    householdName: receipt.householdName,
    storeName: receipt.storeName,
    purchasedAt: purchase.purchasedAt,
    currency: receipt.currency,
    totalPrice: receipt.totalPrice,
    notes: receipt.notes,
    items: receipt.items,
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pantry-pal-receipt-${purchase.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
