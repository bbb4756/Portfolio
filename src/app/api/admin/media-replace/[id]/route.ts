import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security";
import { getAdminSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertSameOrigin(request);
  return NextResponse.json({ error: "Use the direct object-storage replacement flow." }, { status: 410 });
}
