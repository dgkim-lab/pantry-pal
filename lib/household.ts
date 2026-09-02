import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getActiveMembership() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const cookieStore = await cookies();
  const selectedId = cookieStore.get("pantry-pal-household-id")?.value;
  return prisma.householdMember.findFirst({
    where: { userId: session.user.id, ...(selectedId ? { householdId: selectedId } : {}) },
    include: { household: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getHouseholdOptions(userId: string) {
  return prisma.householdMember.findMany({
    where: { userId },
    select: { householdId: true, household: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}
