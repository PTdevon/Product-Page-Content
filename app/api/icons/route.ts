import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAllIcons, getIcon, createIcon, deleteIcon } from "@/lib/icon-metaobjects-store";
import { findIconUsage } from "@/lib/icon-usage";
import { minifySvg } from "@/lib/icons";

export const dynamic = "force-dynamic";

// Server-side SVG sanitizer — no DOM/jsdom dependency needed.
function serverSanitizeSvg(raw: string): string | null {
  if (!raw.includes("<svg")) return null;
  let s = raw;
  // Strip script tags and content
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Strip dangerous elements (self-closing or paired)
  for (const tag of ["iframe", "object", "embed", "form", "input", "base", "meta", "link"]) {
    s = s.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    s = s.replace(new RegExp(`<${tag}[^>]*/?>`, "gi"), "");
  }
  // Strip on* event handlers
  s = s.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\s+on\w+\s*=\s*'[^']*'/gi, "");
  // Strip javascript: URLs
  s = s.replace(/(href|src|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi, "");
  if (!s.includes("<svg")) return null;
  return s;
}

function cleanIconSvg(raw: string, name: string): string | null {
  const sanitized = serverSanitizeSvg(raw);
  if (!sanitized) return null;

  let svg = sanitized;
  svg = svg.replace(/\s+width="[^"]*"/g, "");
  svg = svg.replace(/\s+height="[^"]*"/g, "");
  svg = svg.replace(/\s+class="[^"]*"/g, "");

  if (svg.includes('stroke-width="')) {
    svg = svg.replace(/stroke-width="[^"]*"/g, 'stroke-width="2"');
  }

  if (/(<svg[^>]*)\bid="[^"]*"/.test(svg)) {
    svg = svg.replace(/(<svg[^>]*)\bid="[^"]*"/, `$1id="${name}"`);
  } else {
    svg = svg.replace(/^<svg/, `<svg id="${name}"`);
  }

  return minifySvg(svg);
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const usageName = req.nextUrl.searchParams.get("usage");
  if (usageName) {
    try {
      const usage = await findIconUsage(usageName);
      return NextResponse.json(usage);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to check usage" },
        { status: 500 }
      );
    }
  }

  try {
    const icons = await getAllIcons();
    return NextResponse.json({ icons });
  } catch (e) {
    console.error("[GET /api/icons]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load icons" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  let body: { name?: string; svg?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawSvg = body.svg?.trim() ?? "";
  if (!rawSvg.includes("<svg")) {
    return NextResponse.json({ error: "SVG content is required" }, { status: 400 });
  }

  const name = (body.name?.trim() ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!name) {
    return NextResponse.json(
      { error: "A valid name is required (letters, numbers, hyphens)" },
      { status: 400 }
    );
  }

  const cleanedSvg = cleanIconSvg(rawSvg, name);
  if (!cleanedSvg) {
    return NextResponse.json(
      { error: "SVG contains unsafe content and could not be sanitised" },
      { status: 400 }
    );
  }

  const nameConflict = await getIcon(name);
  if (nameConflict) {
    return NextResponse.json({ error: `"${name}" is already in use` }, { status: 400 });
  }

  try {
    const icon = await createIcon(name, cleanedSvg);
    return NextResponse.json(icon);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save icon" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  let body: { oldName?: string; newName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { oldName, newName: rawNewName } = body;
  if (!oldName || !rawNewName) {
    return NextResponse.json({ error: "oldName and newName are required" }, { status: 400 });
  }

  const newName = rawNewName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!newName) {
    return NextResponse.json(
      { error: "Invalid name — use letters, numbers, and hyphens only" },
      { status: 400 }
    );
  }

  if (newName === oldName) {
    return NextResponse.json({ name: newName });
  }

  const existing = await getIcon(oldName);
  if (!existing) {
    return NextResponse.json({ error: "Icon not found" }, { status: 404 });
  }

  const usage = await findIconUsage(oldName);
  if (usage.products.length > 0 || usage.phrases.length > 0) {
    return NextResponse.json({ error: "in-use", ...usage }, { status: 409 });
  }

  try {
    const created = await createIcon(newName, existing.svg);
    try {
      await deleteIcon(existing.id);
    } catch (delErr) {
      // Clean up the newly created icon so we don't leave behind a duplicate
      try { await deleteIcon(created.id); } catch { /* best-effort */ }
      throw delErr;
    }
    return NextResponse.json({ name: created.handle });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Rename failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const icon = await getIcon(name);
  if (!icon) {
    return NextResponse.json({ error: "Icon not found" }, { status: 404 });
  }

  const usage = await findIconUsage(name);
  if (usage.products.length > 0 || usage.phrases.length > 0) {
    return NextResponse.json({ error: "in-use", ...usage }, { status: 409 });
  }

  try {
    await deleteIcon(icon.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 500 }
    );
  }
}
