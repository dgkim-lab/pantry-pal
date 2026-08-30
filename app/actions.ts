"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getMembership(listId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required");
  const membership = await prisma.householdMember.findFirst({
    where: { userId: session.user.id, household: { lists: { some: { id: listId } } } },
  });
  if (!membership) throw new Error("You do not have access to this list");
  return membership;
}

export async function addListItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");

  const normalizedName = name.toLocaleLowerCase().replace(/\s+/g, " ");
  const master = await prisma.masterItem.findFirst({ where: { householdId: membership.householdId, normalizedName } });
  const resolvedMaster = master ?? await prisma.masterItem.create({ data: { householdId: membership.householdId, createdById: membership.userId, name, normalizedName } });
  const item = await prisma.shoppingListItem.create({
    data: {
      listId,
      masterItemId: resolvedMaster.id,
      name: resolvedMaster.name,
      brand: resolvedMaster.brand,
      quantity: resolvedMaster.defaultQuantity,
      unit: resolvedMaster.defaultUnit,
      capacity: resolvedMaster.capacity,
      capacityUnit: resolvedMaster.capacityUnit,
      notes: resolvedMaster.notes,
    },
  });
  revalidatePath(`/lists/${listId}`);
}

export async function checkListItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const itemId = String(formData.get("itemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const item = await prisma.shoppingListItem.findFirst({ where: { id: itemId, listId } });
  if (!item || item.status !== "OPEN") return;
  const cart = await prisma.cart.upsert({
    where: { listId_status: { listId, status: "ACTIVE" } },
    update: {},
    create: { listId, householdId: membership.householdId },
  });
  await prisma.$transaction([
    prisma.cartItem.create({ data: { cartId: cart.id, listItemId: item.id, masterItemId: item.masterItemId, name: item.name, quantity: item.quantity, unit: item.unit, capacity: item.capacity, capacityUnit: item.capacityUnit, notes: item.notes } }),
    prisma.shoppingListItem.update({ where: { id: item.id }, data: { status: "IN_CART", checkedAt: new Date() } }),
  ]);
  revalidatePath(`/lists/${listId}`);
}

export async function createList(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { memberships: true } });
  if (!user) throw new Error("Account is not provisioned yet");
  const householdId = user.memberships[0]?.householdId ?? (await prisma.household.create({ data: { name: `${user.name ?? "My"} household`, members: { create: { userId: user.id, role: "OWNER" } } } })).id;
  await prisma.shoppingList.create({ data: { householdId, name } });
  revalidatePath("/lists");
}

export async function checkoutCart(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartId = String(formData.get("cartId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot check out carts");
  const cart = await prisma.cart.findFirst({ where: { id: cartId, listId, householdId: membership.householdId, status: "ACTIVE" }, include: { items: true } });
  if (!cart || cart.items.length === 0) return;
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({ data: { householdId: membership.householdId, cartId: cart.id, currency: process.env.DEFAULT_CURRENCY ?? "KRW" } });
    await tx.purchaseItem.createMany({ data: cart.items.map((item) => ({ purchaseId: purchase.id, cartItemId: item.id, masterItemId: item.masterItemId, name: item.name, quantity: item.quantity, unit: item.unit, capacity: item.capacity, capacityUnit: item.capacityUnit, actualPrice: item.expectedPrice, currency: item.currency, notes: item.notes })) });
    await tx.cart.update({ where: { id: cart.id }, data: { status: "CHECKED_OUT", checkedOutAt: new Date() } });
    await tx.shoppingListItem.updateMany({ where: { id: { in: cart.items.flatMap((item) => item.listItemId ? [item.listItemId] : []) } }, data: { status: "PURCHASED" } });
  });
  revalidatePath(`/lists/${listId}`);
}
