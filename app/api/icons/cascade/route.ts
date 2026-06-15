import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { cascadeIconRename } from "@/lib/icon-rename-cascade";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  let body: { oldName?: string; newName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { oldName, newName } = body;
  if (!oldName || !newName) {
    return NextResponse.json({ error: "oldName and newName are required" }, { status: 400 });
  }

  try {
    const updated = await cascadeIconRename(oldName, newName);
    return NextResponse.json({ updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cascade failed" },
      { status: 500 }
    );
  }
}
