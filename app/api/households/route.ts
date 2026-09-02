import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveMembership, getHouseholdOptions } from "@/lib/household";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const [households, active] = await Promise.all([getHouseholdOptions(session.user.id), getActiveMembership()]);
  return NextResponse.json({ households, activeHouseholdId: active?.householdId ?? null });
}
