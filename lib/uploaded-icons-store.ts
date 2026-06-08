import { getLibraryEdits, updateUploadedIcons } from "./library-edits-store";

export interface UploadedIcon { name: string; svg: string }

export async function getUploadedIcons(): Promise<UploadedIcon[]> {
  const edits = await getLibraryEdits();
  return edits.uploadedIcons ?? [];
}

export async function addUploadedIcon(icon: UploadedIcon): Promise<void> {
  const existing = await getUploadedIcons();
  const deduped = existing.filter((i) => i.name !== icon.name);
  await updateUploadedIcons([...deduped, icon]);
}

export async function renameUploadedIcon(oldName: string, newName: string): Promise<void> {
  const existing = await getUploadedIcons();
  const idx = existing.findIndex((i) => i.name === oldName);
  if (idx === -1) throw new Error(`Icon "${oldName}" not found`);
  const updated = [...existing];
  updated[idx] = { ...updated[idx], name: newName };
  await updateUploadedIcons(updated);
}

export async function deleteUploadedIcon(name: string): Promise<void> {
  const existing = await getUploadedIcons();
  await updateUploadedIcons(existing.filter((i) => i.name !== name));
}
