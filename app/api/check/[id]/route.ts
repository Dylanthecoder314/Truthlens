import { NextResponse } from "next/server";
import { getCheck } from "@/lib/db";
import type { ApiError } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/check/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]{6,32}$/.test(id)) {
    const body: ApiError = { error: { code: "not_found", message: "No check found with that ID." } };
    return NextResponse.json(body, { status: 404 });
  }
  const check = await getCheck(id);
  if (!check) {
    const body: ApiError = { error: { code: "not_found", message: "No check found with that ID." } };
    return NextResponse.json(body, { status: 404 });
  }
  return NextResponse.json(check);
}
