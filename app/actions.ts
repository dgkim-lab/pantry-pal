"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ItemAttribute = { attributeKey: string; value: string; valueType: "TEXT" | "NUMBER" | "BOOLEAN" };

function purchaseAttributes(attributes: readonly ItemAttribute[]) {
  const priceAttributes = attributes.filter((attribute) => ["actualPrice", "actual_price", "actualprice", "expectedPrice", "expected_price", "expectedprice"].includes(attribute.attributeKey));
  const actualPrice = priceAttributes.find((attribute) => ["actualPrice", "actual_price", "actualprice"].includes(attribute.attributeKey));
  const expectedPrice = priceAttributes.find((attribute) => ["expectedPrice", "expected_price", "expectedprice"].includes(attribute.attributeKey));
  const copied = attributes.filter((attribute) => !priceAttributes.includes(attribute));
  const price = actualPrice ?? expectedPrice;
  if (price) copied.push({ ...price, attributeKey: "actualPrice" });
  return copied;
}

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
  const master = await prisma.masterItem.findFirst({ where: { householdId: membership.householdId, normalizedName }, include: { attributes: true } });
  const resolvedMaster = master ?? { ...(await prisma.masterItem.create({ data: { householdId: membership.householdId, createdById: membership.userId, name, normalizedName } })), attributes: [] };
  const item = await prisma.shoppingListItem.create({
    data: {
      listId,
      masterItemId: resolvedMaster.id,
      name: resolvedMaster.name,
      attributes: { create: resolvedMaster.attributes.map((attribute) => ({ attributeKey: attribute.attributeKey, value: attribute.value, valueType: attribute.valueType })) },
    },
  });
  revalidatePath(`/lists/${listId}`);
}

export async function checkListItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const itemId = String(formData.get("itemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const item = await prisma.shoppingListItem.findFirst({ where: { id: itemId, listId }, include: { attributes: true } });
  if (!item || item.status !== "OPEN") return;
  const cart = await prisma.cart.findFirst({ where: { listId, householdId: membership.householdId, status: "ACTIVE" } }) ??
    await prisma.cart.create({ data: { listId, householdId: membership.householdId } });
  await prisma.$transaction([
    prisma.cartItem.create({ data: { cartId: cart.id, listItemId: item.id, masterItemId: item.masterItemId, name: item.name, attributes: { create: item.attributes.map((attribute) => ({ attributeKey: attribute.attributeKey, value: attribute.value, valueType: attribute.valueType })) } } }),
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

export async function uncartItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartItemId = String(formData.get("cartItemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const cartItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { listId, householdId: membership.householdId, status: "ACTIVE" } },
    select: { id: true, listItemId: true },
  });
  if (!cartItem) return;
  await prisma.$transaction([
    prisma.cartItem.delete({ where: { id: cartItem.id } }),
    ...(cartItem.listItemId ? [prisma.shoppingListItem.update({ where: { id: cartItem.listItemId }, data: { status: "OPEN", checkedAt: null } })] : []),
  ]);
  revalidatePath(`/lists/${listId}`);
}

function optionalValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function attributeKey(value: string) {
  return value.trim().slice(0, 80);
}

function attributeType(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === "NUMBER" ? "NUMBER" : normalized === "BOOLEAN" ? "BOOLEAN" : "TEXT";
}

function formItemAttributes(formData: FormData) {
  const definitions: Array<[string, "TEXT" | "NUMBER" | "BOOLEAN"]> = [["brand", "TEXT"], ["category", "TEXT"], ["defaultQuantity", "NUMBER"], ["defaultUnit", "TEXT"], ["quantity", "NUMBER"], ["unit", "TEXT"], ["capacity", "NUMBER"], ["capacityUnit", "TEXT"], ["defaultPrice", "NUMBER"], ["expectedPrice", "NUMBER"], ["actualPrice", "NUMBER"], ["currency", "TEXT"], ["notes", "TEXT"]];
  return definitions.flatMap(([attributeKey, valueType]) => { const value = optionalValue(formData, attributeKey); return value ? [{ attributeKey, value, valueType }] : []; });
}

async function replaceListAttributes(shoppingListItemId: string, attributes: ItemAttribute[]) {
  await prisma.shoppingListItemAttribute.deleteMany({ where: { shoppingListItemId } });
  if (attributes.length) await prisma.shoppingListItemAttribute.createMany({ data: attributes.map((attribute) => ({ shoppingListItemId, ...attribute })) });
}

async function replaceCartAttributes(cartItemId: string, attributes: ItemAttribute[]) {
  await prisma.cartItemAttribute.deleteMany({ where: { cartItemId } });
  if (attributes.length) await prisma.cartItemAttribute.createMany({ data: attributes.map((attribute) => ({ cartItemId, ...attribute })) });
}

export async function saveMasterAttribute(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit catalog items");
  const masterItemId = String(formData.get("masterItemId"));
  const item = await prisma.masterItem.findFirst({ where: { id: masterItemId, householdId: membership.householdId } });
  const key = attributeKey(String(formData.get("attributeKey") ?? ""));
  const value = String(formData.get("value") ?? "").trim();
  if (!item || !key || !value) return;
  await prisma.masterItemAttribute.upsert({ where: { masterItemId_attributeKey: { masterItemId, attributeKey: key } }, update: { value, valueType: attributeType(String(formData.get("valueType"))) }, create: { masterItemId, attributeKey: key, value, valueType: attributeType(String(formData.get("valueType"))) } });
  revalidatePath("/catalog");
}

export async function deleteMasterAttribute(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit catalog items");
  const masterItemId = String(formData.get("masterItemId"));
  const attributeKey = String(formData.get("attributeKey"));
  await prisma.masterItemAttribute.deleteMany({
    where: { masterItemId, attributeKey, masterItem: { householdId: membership.householdId } },
  });
  revalidatePath("/catalog");
}

export async function saveListItemAttribute(formData: FormData) {
  const listId = String(formData.get("listId"));
  const itemId = String(formData.get("itemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const item = await prisma.shoppingListItem.findFirst({ where: { id: itemId, listId } });
  const key = attributeKey(String(formData.get("attributeKey") ?? ""));
  const value = String(formData.get("value") ?? "").trim();
  if (!item || !key || !value) return;
  await prisma.shoppingListItemAttribute.upsert({ where: { shoppingListItemId_attributeKey: { shoppingListItemId: itemId, attributeKey: key } }, update: { value, valueType: attributeType(String(formData.get("valueType"))) }, create: { shoppingListItemId: itemId, attributeKey: key, value, valueType: attributeType(String(formData.get("valueType"))) } });
  revalidatePath(`/lists/${listId}`);
}

export async function deleteListItemAttribute(formData: FormData) {
  const listId = String(formData.get("listId"));
  const itemId = String(formData.get("itemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const attributeKey = String(formData.get("attributeKey"));
  await prisma.shoppingListItemAttribute.deleteMany({
    where: { shoppingListItemId: itemId, attributeKey, shoppingListItem: { listId } },
  });
  revalidatePath(`/lists/${listId}`);
}

export async function saveCartItemAttribute(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartItemId = String(formData.get("cartItemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit carts");
  const item = await prisma.cartItem.findFirst({ where: { id: cartItemId, cart: { listId, householdId: membership.householdId, status: "ACTIVE" } } });
  const key = attributeKey(String(formData.get("attributeKey") ?? ""));
  const value = String(formData.get("value") ?? "").trim();
  if (!item || !key || !value) return;
  await prisma.cartItemAttribute.upsert({ where: { cartItemId_attributeKey: { cartItemId, attributeKey: key } }, update: { value, valueType: attributeType(String(formData.get("valueType"))) }, create: { cartItemId, attributeKey: key, value, valueType: attributeType(String(formData.get("valueType"))) } });
  revalidatePath(`/lists/${listId}`);
}

export async function deleteCartItemAttribute(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartItemId = String(formData.get("cartItemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit carts");
  const attributeKey = String(formData.get("attributeKey"));
  await prisma.cartItemAttribute.deleteMany({
    where: { cartItemId, attributeKey, cartItem: { cart: { listId, householdId: membership.householdId, status: "ACTIVE" } } },
  });
  revalidatePath(`/lists/${listId}`);
}

async function getHouseholdMembership() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required");
  const membership = await prisma.householdMember.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } });
  if (!membership) throw new Error("Household membership required");
  return membership;
}

export async function updateList(formData: FormData) {
  const listId = String(formData.get("listId"));
  const name = String(formData.get("name") ?? "").trim();
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER" || !name) throw new Error("You cannot update this list");
  await prisma.shoppingList.update({ where: { id: listId }, data: { name } });
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

export async function deleteList(formData: FormData) {
  const listId = String(formData.get("listId"));
  const membership = await getMembership(listId);
  if (membership.role !== "OWNER") throw new Error("Only household owners can delete lists");
  await prisma.shoppingList.delete({ where: { id: listId } });
  revalidatePath("/lists");
  redirect("/lists");
}

export async function updateListItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const itemId = String(formData.get("itemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const item = await prisma.shoppingListItem.findFirst({ where: { id: itemId, listId } });
  if (!item) return;
  await prisma.shoppingListItem.update({ where: { id: itemId }, data: { name: String(formData.get("name") ?? item.name).trim() || item.name } });
  await replaceListAttributes(itemId, formItemAttributes(formData));
  revalidatePath(`/lists/${listId}`);
}

export async function deleteListItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const itemId = String(formData.get("itemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot delete list items");
  await prisma.shoppingListItem.deleteMany({ where: { id: itemId, listId } });
  revalidatePath(`/lists/${listId}`);
}

export async function updateCartItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartItemId = String(formData.get("cartItemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit carts");
  const item = await prisma.cartItem.findFirst({ where: { id: cartItemId, cart: { listId, householdId: membership.householdId, status: "ACTIVE" } } });
  if (!item) return;
  await replaceCartAttributes(cartItemId, formItemAttributes(formData));
  revalidatePath(`/lists/${listId}`);
}

export async function updateCartStore(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartId = String(formData.get("cartId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit carts");
  await prisma.cart.updateMany({ where: { id: cartId, listId, householdId: membership.householdId, status: "ACTIVE" }, data: { storeId: optionalValue(formData, "storeId") } });
  revalidatePath(`/lists/${listId}`);
}

export async function createStore(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot create stores");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.store.create({ data: { householdId: membership.householdId, name, type: String(formData.get("type")) === "ONLINE" ? "ONLINE" : "LOCAL", address: optionalValue(formData, "address"), url: optionalValue(formData, "url"), notes: optionalValue(formData, "notes") } });
  revalidatePath("/stores");
}

export async function updateStore(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit stores");
  const storeId = String(formData.get("storeId"));
  await prisma.store.updateMany({ where: { id: storeId, householdId: membership.householdId }, data: { name: String(formData.get("name") ?? "").trim(), type: String(formData.get("type")) === "ONLINE" ? "ONLINE" : "LOCAL", address: optionalValue(formData, "address"), url: optionalValue(formData, "url"), notes: optionalValue(formData, "notes") } });
  revalidatePath("/stores");
}

export async function deleteStore(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role !== "OWNER") throw new Error("Only household owners can delete stores");
  await prisma.store.deleteMany({ where: { id: String(formData.get("storeId")), householdId: membership.householdId } });
  revalidatePath("/stores");
}

export async function saveMasterItem(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit catalog items");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const masterItemId = optionalValue(formData, "masterItemId");
  const data = { name, normalizedName: name.toLocaleLowerCase().replace(/\s+/g, " ") };
  const item = masterItemId ? await prisma.masterItem.update({ where: { id: masterItemId }, data }) : await prisma.masterItem.create({ data: { ...data, householdId: membership.householdId, createdById: membership.userId } });
  if (!masterItemId) {
    await prisma.masterItemAttribute.createMany({
      data: [
        { masterItemId: item.id, attributeKey: "defaultQuantity", value: "1", valueType: "NUMBER" },
        { masterItemId: item.id, attributeKey: "currency", value: process.env.DEFAULT_CURRENCY || "KRW", valueType: "TEXT" },
      ],
    });
  }
  revalidatePath("/catalog");
}

export async function deleteMasterItem(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot delete catalog items");
  await prisma.masterItem.deleteMany({
    where: { id: String(formData.get("masterItemId")), householdId: membership.householdId },
  });
  revalidatePath("/catalog");
}

export async function checkoutCart(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartId = String(formData.get("cartId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot check out carts");
  const cart = await prisma.cart.findFirst({ where: { id: cartId, listId, householdId: membership.householdId, status: "ACTIVE" }, include: { items: { include: { attributes: true } } } });
  if (!cart || cart.items.length === 0) return;
  const purchasedAt = new Date(String(formData.get("purchasedAt") || new Date().toISOString()));
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({ data: { householdId: membership.householdId, cartId: cart.id, storeId: optionalValue(formData, "storeId"), purchasedAt: Number.isNaN(purchasedAt.getTime()) ? new Date() : purchasedAt, currency: String(formData.get("currency") || process.env.DEFAULT_CURRENCY || "KRW"), totalPrice: optionalValue(formData, "totalPrice"), notes: optionalValue(formData, "notes") } });
    for (const item of cart.items) {
      const purchaseItem = await tx.purchaseItem.create({ data: { purchaseId: purchase.id, cartItemId: item.id, masterItemId: item.masterItemId, name: item.name } });
      const attributes = purchaseAttributes(item.attributes);
      if (attributes.length) await tx.purchaseItemAttribute.createMany({ data: attributes.map((attribute) => ({ purchaseItemId: purchaseItem.id, attributeKey: attribute.attributeKey, value: attribute.value, valueType: attribute.valueType })) });
    }
    await tx.cart.update({ where: { id: cart.id }, data: { status: "CHECKED_OUT", checkedOutAt: new Date() } });
    await tx.shoppingListItem.updateMany({ where: { id: { in: cart.items.flatMap((item) => item.listItemId ? [item.listItemId] : []) } }, data: { status: "PURCHASED" } });
  });
  revalidatePath(`/lists/${listId}`); revalidatePath("/history");
}

export async function buyAgain(formData: FormData) {
  const listId = String(formData.get("listId"));
  const purchaseItemId = String(formData.get("purchaseItemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const source = await prisma.purchaseItem.findFirst({ where: { id: purchaseItemId, purchase: { householdId: membership.householdId } }, include: { attributes: true } });
  if (!source) return;
  await prisma.shoppingListItem.create({ data: { listId, masterItemId: source.masterItemId, name: source.name, attributes: { create: source.attributes.map((attribute) => ({ attributeKey: ["actualPrice", "actual_price", "actualprice"].includes(attribute.attributeKey) ? "expected_price" : attribute.attributeKey, value: attribute.value, valueType: attribute.valueType })) } } });
  revalidatePath(`/lists/${listId}`);
}
