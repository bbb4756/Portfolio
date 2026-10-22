import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/session";
import { assertSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  assertSameOrigin(request);
  await clearAdminSession();
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
