import Nav from "@/components/Nav";

export default function BulkPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Nav active="bulk" />
      <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
        Bulk assign — coming in Phase 2
      </div>
    </div>
  );
}
