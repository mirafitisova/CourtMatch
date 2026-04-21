import { Navigation } from "@/components/Navigation";
import { CourtDirectory } from "@/components/CourtDirectory";

export default function Courts() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="md:pl-64 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-16 md:top-0 z-10">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold text-slate-800">Court Directory</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Find public and school courts near you
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          <CourtDirectory />
        </div>
      </div>
    </div>
  );
}
