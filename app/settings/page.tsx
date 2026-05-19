import Nav from "@/components/Nav";

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Nav active="settings" />
      <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
        Settings — coming in Phase 2
      </div>
    </div>
  );
}
