import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings-store";

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  return NextResponse.json(await getSettings());
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const body = await req.json();
  await saveSettings(body);
  return NextResponse.json({ ok: true });
}
