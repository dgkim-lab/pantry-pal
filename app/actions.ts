"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishPrintMessage, publishReceiptMessage } from "@/lib/receipt-queue";

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

export async function addMasterItemsToList(formData: FormData) {
  const listId = String(formData.get("listId") ?? "");
  const masterItemIds = [...new Set(formData.getAll("masterItemId").map(String).filter(Boolean))];
  if (!listId || masterItemIds.length === 0) return;
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const masters = await prisma.masterItem.findMany({
    where: { id: { in: masterItemIds }, householdId: membership.householdId },
    include: { attributes: true },
  });
  const existingItems = await prisma.shoppingListItem.findMany({
    where: { listId, status: { in: ["OPEN", "IN_CART"] } },
    select: { name: true, masterItemId: true },
  });
  const existingMasterIds = new Set(existingItems.flatMap((item) => item.masterItemId ? [item.masterItemId] : []));
  const names = new Set(existingItems.map((item) => item.name.toLocaleLowerCase().replace(/\s+/g, " ").trim()));
  const mastersToAdd = masters.filter((master) => {
    const normalizedName = master.name.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (existingMasterIds.has(master.id) || names.has(normalizedName)) return false;
    existingMasterIds.add(master.id);
    names.add(normalizedName);
    return true;
  });
  await prisma.$transaction(mastersToAdd.map((master) => prisma.shoppingListItem.create({
    data: {
      listId,
      masterItemId: master.id,
      name: master.name,
      attributes: { create: master.attributes.map(({ attributeKey, value, valueType }) => ({ attributeKey, value, valueType })) },
    },
  })));
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/catalog");
}

export async function checkListItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const itemId = String(formData.get("itemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const item = await prisma.shoppingListItem.findFirst({ where: { id: itemId, listId }, include: { attributes: true, list: { select: { defaultStoreId: true } } } });
  if (!item || item.status !== "OPEN") return;
  const cart = await prisma.cart.findFirst({ where: { listId, householdId: membership.householdId, status: "ACTIVE" } }) ??
    await prisma.cart.create({ data: { listId, householdId: membership.householdId, storeId: item.list.defaultStoreId } });
  await prisma.$transaction(async (tx) => {
    if (!cart.storeId && item.list.defaultStoreId) {
      await tx.cart.update({ where: { id: cart.id }, data: { storeId: item.list.defaultStoreId } });
    }
    await tx.cartItem.create({ data: { cartId: cart.id, listItemId: item.id, masterItemId: item.masterItemId, name: item.name, attributes: { create: item.attributes.map((attribute) => ({ attributeKey: attribute.attributeKey, value: attribute.value, valueType: attribute.valueType })) } } });
    await tx.shoppingListItem.update({ where: { id: item.id }, data: { status: "IN_CART", checkedAt: new Date() } });
  });
  revalidatePath(`/lists/${listId}`);
}

export async function createList(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot create lists");
  await prisma.shoppingList.create({ data: { householdId: membership.householdId, name } });
  revalidatePath("/lists");
}

export async function uncartItem(formData: FormData) {
  const listId = String(formData.get("listId"));
  const cartItemId = String(formData.get("cartItemId"));
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER") throw new Error("Viewers cannot edit lists");
  const cartItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { listId, householdId: membership.householdId, status: "ACTIVE" } },
    select: { id: true, listItemId: true, cartId: true },
  });
  if (!cartItem) return;
  await prisma.$transaction(async (tx) => {
    await tx.cartItem.delete({ where: { id: cartItem.id } });
    if (cartItem.listItemId) {
      await tx.shoppingListItem.update({ where: { id: cartItem.listItemId }, data: { status: "OPEN", checkedAt: null } });
    }
    await tx.cart.deleteMany({ where: { id: cartItem.cartId, status: "ACTIVE", items: { none: {} } } });
  });
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

async function updateCartItemFields(cartItemId: string, formData: FormData) {
  const fields: Array<[string, string[], "TEXT" | "NUMBER" | "BOOLEAN"]> = [
    ["quantity", ["quantity", "defaultQuantity", "default_quantity", "defaultquantity"], "NUMBER"],
    ["actualPrice", ["actualPrice", "actual_price", "actualprice"], "NUMBER"],
  ];

  for (const [field, aliases, valueType] of fields) {
    const value = String(formData.get(field) ?? "").trim();
    await prisma.cartItemAttribute.deleteMany({ where: { cartItemId, attributeKey: { in: aliases } } });
    if (value) {
      await prisma.cartItemAttribute.create({ data: { cartItemId, attributeKey: field, value, valueType } });
    }
  }
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
  const selectedId = (await cookies()).get("pantry-pal-household-id")?.value;
  const membership = await prisma.householdMember.findFirst({ where: { userId: session.user.id, ...(selectedId ? { householdId: selectedId } : {}) }, orderBy: { createdAt: "asc" } });
  if (!membership) throw new Error("Household membership required");
  return membership;
}

async function requireOwner() {
  const membership = await getHouseholdMembership();
  if (membership.role !== "OWNER") throw new Error("Only household owners can manage members");
  return membership;
}

export async function createHousehold(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const household = await prisma.household.create({ data: { name, members: { create: { userId: session.user.id, role: "OWNER" } } } });
  (await cookies()).set("pantry-pal-household-id", household.id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/households"); revalidatePath("/lists");
}

export async function switchHousehold(formData: FormData) {
  const id = String(formData.get("householdId") ?? "");
  const session = await auth();
  if (!session?.user?.id || !id) throw new Error("Sign in required");
  const membership = await prisma.householdMember.findFirst({ where: { householdId: id, userId: session.user.id } });
  if (!membership) throw new Error("You do not have access to this household");
  (await cookies()).set("pantry-pal-household-id", id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/households"); revalidatePath("/lists");
  redirect("/lists");
}

export async function inviteMember(formData: FormData) {
  const membership = await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) === "VIEWER" ? "VIEWER" : "EDITOR";
  if (!email) return;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && await prisma.householdMember.findUnique({ where: { householdId_userId: { householdId: membership.householdId, userId: existing.id } } })) throw new Error("That person is already a member");
  const invitation = await prisma.householdInvitation.create({ data: { householdId: membership.householdId, invitedById: membership.userId, email, role, token: randomUUID(), expiresAt: new Date(Date.now() + 7 * 86400000) } });
  revalidatePath("/households");
}

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const session = await auth();
  if (!session?.user?.id || !token) throw new Error("Sign in required");
  const invitation = await prisma.householdInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new Error("This invitation is no longer valid");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.email.toLowerCase() !== invitation.email) throw new Error("Sign in with the invited email address");
  await prisma.$transaction([
    prisma.householdMember.upsert({ where: { householdId_userId: { householdId: invitation.householdId, userId: user.id } }, update: { role: invitation.role }, create: { householdId: invitation.householdId, userId: user.id, role: invitation.role } }),
    prisma.householdInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ]);
  (await cookies()).set("pantry-pal-household-id", invitation.householdId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/lists");
}

export async function updateMemberRole(formData: FormData) {
  const owner = await requireOwner();
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role"));
  const member = await prisma.householdMember.findFirst({ where: { id: memberId, householdId: owner.householdId } });
  if (!member || member.userId === owner.userId || !["OWNER", "EDITOR", "VIEWER"].includes(role)) return;
  if (member.role === "OWNER" && role !== "OWNER") {
    const owners = await prisma.householdMember.count({ where: { householdId: owner.householdId, role: "OWNER" } });
    if (owners <= 1) throw new Error("A household must have an owner");
  }
  await prisma.householdMember.update({ where: { id: memberId }, data: { role: role as "OWNER" | "EDITOR" | "VIEWER" } });
  revalidatePath("/households");
}

export async function removeMember(formData: FormData) {
  const owner = await requireOwner();
  const memberId = String(formData.get("memberId") ?? "");
  const member = await prisma.householdMember.findFirst({ where: { id: memberId, householdId: owner.householdId } });
  if (!member || member.userId === owner.userId) return;
  await prisma.householdMember.delete({ where: { id: memberId } });
  revalidatePath("/households");
}

export async function updateList(formData: FormData) {
  const listId = String(formData.get("listId"));
  const name = String(formData.get("name") ?? "").trim();
  const defaultStoreId = optionalValue(formData, "defaultStoreId");
  const membership = await getMembership(listId);
  if (membership.role === "VIEWER" || !name) throw new Error("You cannot update this list");
  if (defaultStoreId) {
    const store = await prisma.store.findFirst({ where: { id: defaultStoreId, householdId: membership.householdId } });
    if (!store) throw new Error("Invalid default store");
  }
  await prisma.$transaction(async (tx) => {
    await tx.shoppingList.update({ where: { id: listId }, data: { name, defaultStoreId } });
    if (defaultStoreId) {
      await tx.cart.updateMany({
        where: { listId, householdId: membership.householdId, status: "ACTIVE", storeId: null },
        data: { storeId: defaultStoreId },
      });
    }
  });
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
  await updateCartItemFields(cartItemId, formData);
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
  const item = masterItemId ? await prisma.masterItem.updateMany({ where: { id: masterItemId, householdId: membership.householdId }, data }).then(async (result) => { if (!result.count) throw new Error("Catalog item not found"); return prisma.masterItem.findUniqueOrThrow({ where: { id: masterItemId } }); }) : await prisma.masterItem.create({ data: { ...data, householdId: membership.householdId, createdById: membership.userId } });
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
  const purchaseId = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({ data: { householdId: membership.householdId, cartId: cart.id, storeId: optionalValue(formData, "storeId") || cart.storeId, purchasedAt: Number.isNaN(purchasedAt.getTime()) ? new Date() : purchasedAt, currency: String(formData.get("currency") || process.env.DEFAULT_CURRENCY || "KRW"), totalPrice: optionalValue(formData, "totalPrice"), notes: optionalValue(formData, "notes") } });
    for (const item of cart.items) {
      const purchaseItem = await tx.purchaseItem.create({ data: { purchaseId: purchase.id, cartItemId: item.id, masterItemId: item.masterItemId, name: item.name } });
      const attributes = purchaseAttributes(item.attributes);
      if (attributes.length) await tx.purchaseItemAttribute.createMany({ data: attributes.map((attribute) => ({ purchaseItemId: purchaseItem.id, attributeKey: attribute.attributeKey, value: attribute.value, valueType: attribute.valueType })) });
    }
    await tx.cart.update({ where: { id: cart.id }, data: { status: "CHECKED_OUT", checkedOutAt: new Date() } });
    await tx.shoppingListItem.updateMany({ where: { id: { in: cart.items.flatMap((item) => item.listItemId ? [item.listItemId] : []) } }, data: { status: "PURCHASED" } });
    return purchase.id;
  });
  const session = await auth();
  if (session?.user?.email) {
    try {
      await publishReceiptMessage({ recipient: session.user.email, purchaseId });
    } catch (error) {
      // Receipt delivery is asynchronous; RabbitMQ downtime must not make a
      // successful checkout look like it failed to the user.
      console.error("Purchase completed but receipt message could not be published", error);
    }
  }
  try {
    await publishPrintMessage({ purchaseId });
  } catch (error) {
    // Printing is asynchronous and must not make a completed checkout fail.
    console.error("Purchase completed but print message could not be published", error);
  }
  revalidatePath(`/lists/${listId}`); revalidatePath("/history");
}

export async function printReceipt(formData: FormData) {
  const purchaseId = String(formData.get("purchaseId") ?? "");
  if (!purchaseId) return;
  const membership = await getHouseholdMembership();
  const purchase = await prisma.purchase.findFirst({ where: { id: purchaseId, householdId: membership.householdId }, select: { id: true } });
  if (!purchase) throw new Error("Purchase not found");
  await publishPrintMessage({ purchaseId: purchase.id });
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

export async function deletePurchase(formData: FormData) {
  const membership = await getHouseholdMembership();
  if (membership.role === "VIEWER") throw new Error("Viewers cannot delete purchases");
  const purchaseId = String(formData.get("purchaseId") ?? "");
  if (!purchaseId) return;
  await prisma.purchase.deleteMany({ where: { id: purchaseId, householdId: membership.householdId } });
  revalidatePath("/history");
}
