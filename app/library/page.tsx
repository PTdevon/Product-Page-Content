import Nav from "@/components/Nav";

export default function LibraryPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Nav active="library" />
      <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
        Library browser — coming in Phase 2
      </div>
    </div>
  );
}
