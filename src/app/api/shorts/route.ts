import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const longFormId = url.searchParams.get("longFormId");
  const items = await db.short.findMany({
    where: longFormId ? { longFormId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { longForm: { select: { title: true } } },
  });
  return NextResponse.json({ items });
}
