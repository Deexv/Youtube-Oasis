import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/youtube/accounts-default
 * body: { id }
 * Sets the given account as the default (unsets all others).
 */
export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await db.$transaction([
    db.youTubeAccount.updateMany({
      data: { isDefault: false },
    }),
    db.youTubeAccount.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
