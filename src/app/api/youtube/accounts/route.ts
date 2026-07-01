import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listAccounts } from "@/lib/youtube";

/**
 * GET /api/youtube/accounts — list all connected accounts.
 */
export async function GET() {
  const accounts = await listAccounts();
  return NextResponse.json({ accounts });
}

/**
 * DELETE /api/youtube/accounts?id=... — disconnect an account.
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await db.youTubeAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
