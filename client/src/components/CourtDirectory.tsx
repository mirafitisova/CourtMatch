import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  MapPin, Lightbulb, LightbulbOff, ChevronDown, ChevronUp,
  ExternalLink, Navigation2, SlidersHorizontal, X, CheckCircle,
  Car, Clock, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Court {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  courtType: "PUBLIC_FREE" | "PUBLIC_PAY" | "PRIVATE" | "SCHOOL";
  cost: string | null;
  bookingMethod: string;
  numberOfCourts: number;
  surface: string;
  hasLights: boolean;
  hours: string | null;
  netCondition: "GOOD" | "FAIR" | "POOR" | null;
  hasRestrooms: boolean;
  parkingInfo: string | null;
  bestTimes: string | null;
  juniorNotes: string | null;
  bookingUrl: string | null;
  distanceMiles: number | null;
}

type CourtTypeFilter = "ALL" | "PUBLIC_FREE" | "PUBLIC_PAY" | "SCHOOL" | "PRIVATE";
type SortKey = "distance" | "name";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string }> = {
  PUBLIC_FREE: { label: "Free",    color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  PUBLIC_PAY:  { label: "Pay",     color: "bg-amber-100  text-amber-700  border-amber-200"  },
  PRIVATE:     { label: "Private", color: "bg-slate-100  text-slate-600  border-slate-200"  },
  SCHOOL:      { label: "School",  color: "bg-blue-100   text-blue-700   border-blue-200"   },
};

const NET_META: Record<string, { label: string; dot: string }> = {
  GOOD: { label: "Good",  dot: "bg-emerald-500" },
  FAIR: { label: "Fair",  dot: "bg-amber-500"   },
  POOR: { label: "Poor",  dot: "bg-red-500"     },
};

function mapsUrl(court: Court) {
  const q = encodeURIComponent(court.address);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

// ── Court type badge ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: Court["courtType"] }) {
  const { label, color } = TYPE_META[type] ?? { label: type, color: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {label}
    </span>
  );
}

// ── Individual court card ─────────────────────────────────────────────────────

function CourtCard({
  court,
  selectable,
  selected,
  onSelect,
}: {
  court: Court;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (court: Court) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleCardClick = () => {
    if (selectable && onSelect) {
      onSelect(court);
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <div
      className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-slate-200 hover:shadow-md"
      } ${selectable ? "cursor-pointer" : ""}`}
    >
      {/* ── Card header — always visible ── */}
      <div
        className="p-4 flex gap-3 items-start"
        onClick={handleCardClick}
        style={{ cursor: "pointer" }}
      >
        {/* Selection indicator */}
        {selectable && (
          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            selected ? "border-primary bg-primary" : "border-slate-300"
          }`}>
            {selected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        )}

        {/* Court icon */}
        {!selectable && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800 leading-snug">{court.name}</p>
            {!selectable && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                className="shrink-0 text-slate-400 hover:text-slate-600 p-0.5"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <TypeBadge type={court.courtType} />
            {court.hasLights ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                <Lightbulb className="w-3 h-3" /> Lights
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <LightbulbOff className="w-3 h-3" /> No lights
              </span>
            )}
            <span className="text-xs text-slate-500">{court.numberOfCourts} courts</span>
            <span className="text-xs text-slate-500">{court.surface}</span>
            {court.distanceMiles !== null && (
              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                <Navigation2 className="w-3 h-3" />
                {court.distanceMiles} mi
              </span>
            )}
          </div>

          {/* Cost hint */}
          {court.cost && (
            <p className="text-xs text-slate-500 mt-1">{court.cost}</p>
          )}
        </div>
      </div>

      {/* ── Expanded detail (non-selectable mode only) ── */}
      {!selectable && expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Address + Maps link */}
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">{court.address}</p>
              <a
                href={mapsUrl(court)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
              >
                <Navigation2 className="w-3 h-3" />
                Get directions
              </a>
            </div>
          </div>

          {/* Hours */}
          {court.hours && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">{court.hours}</p>
            </div>
          )}

          {/* Booking */}
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">{court.bookingMethod}</p>
              {court.bookingUrl && (
                <a
                  href={court.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Book online
                </a>
              )}
            </div>
          </div>

          {/* Net condition */}
          {court.netCondition && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${NET_META[court.netCondition]?.dot}`} />
              <p className="text-sm text-slate-700">
                Net condition: {NET_META[court.netCondition]?.label ?? court.netCondition}
              </p>
            </div>
          )}

          {/* Parking */}
          {court.parkingInfo && (
            <div className="flex items-start gap-2">
              <Car className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">{court.parkingInfo}</p>
            </div>
          )}

          {/* Best times */}
          {court.bestTimes && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">Best times: {court.bestTimes}</p>
            </div>
          )}

          {/* Junior notes */}
          {court.juniorNotes && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{court.juniorNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main CourtDirectory component ─────────────────────────────────────────────

interface CourtDirectoryProps {
  /** When true, cards show a radio-style selector instead of expand/collapse */
  selectable?: boolean;
  /** Currently selected court id (selectable mode) */
  selectedId?: number | null;
  /** Called when user taps a card in selectable mode */
  onSelect?: (court: Court) => void;
  /** Hide the top filter bar (useful when embedding in a smaller space) */
  compact?: boolean;
}

export function CourtDirectory({
  selectable = false,
  selectedId = null,
  onSelect,
  compact = false,
}: CourtDirectoryProps) {
  const [typeFilter, setTypeFilter] = useState<CourtTypeFilter>("ALL");
  const [lightsOnly, setLightsOnly] = useState(false);
  const [maxDist, setMaxDist] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("distance");
  const [showFilters, setShowFilters] = useState(false);

  const { data: allCourts = [], isLoading } = useQuery<Court[]>({
    queryKey: ["/api/courts"],
    queryFn: () => apiRequest("GET", "/api/courts").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    let list = [...allCourts];

    if (typeFilter !== "ALL") list = list.filter((c) => c.courtType === typeFilter);
    if (lightsOnly) list = list.filter((c) => c.hasLights);
    if (maxDist !== null) {
      list = list.filter((c) => c.distanceMiles === null || c.distanceMiles <= maxDist);
    }

    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      // distance — nulls last
      if (a.distanceMiles === null && b.distanceMiles === null) return 0;
      if (a.distanceMiles === null) return 1;
      if (b.distanceMiles === null) return -1;
      return a.distanceMiles - b.distanceMiles;
    });

    return list;
  }, [allCourts, typeFilter, lightsOnly, maxDist, sort]);

  const activeFilterCount =
    (typeFilter !== "ALL" ? 1 : 0) + (lightsOnly ? 1 : 0) + (maxDist !== null ? 1 : 0);

  const resetFilters = () => {
    setTypeFilter("ALL");
    setLightsOnly(false);
    setMaxDist(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Filter / sort bar ── */}
      {!compact && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Toggle row */}
          <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 shrink-0">Sort:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(["distance", "name"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                      sort === k ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {k === "distance" ? "Nearest" : "Name"}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="border-t border-slate-100 px-4 py-3 space-y-3">
              {/* Court type */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Court type
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["ALL", "PUBLIC_FREE", "PUBLIC_PAY", "SCHOOL", "PRIVATE"] as CourtTypeFilter[]).map(
                    (t) => {
                      const label =
                        t === "ALL" ? "All" : TYPE_META[t]?.label ?? t;
                      return (
                        <button
                          key={t}
                          onClick={() => setTypeFilter(t)}
                          className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors ${
                            typeFilter === t
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-slate-600 border-slate-300 hover:border-primary"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Lights + distance */}
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lightsOnly}
                    onChange={(e) => setLightsOnly(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span className="text-sm text-slate-700 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Has lights
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700 shrink-0">Within</span>
                  <select
                    value={maxDist ?? ""}
                    onChange={(e) =>
                      setMaxDist(e.target.value ? Number(e.target.value) : null)
                    }
                    className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Any distance</option>
                    <option value="5">5 miles</option>
                    <option value="10">10 miles</option>
                    <option value="15">15 miles</option>
                    <option value="25">25 miles</option>
                  </select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Reset filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Compact filter strip (embedded mode) ── */}
      {compact && (
        <div className="flex flex-wrap gap-2 items-center">
          {(["ALL", "PUBLIC_FREE", "PUBLIC_PAY", "SCHOOL"] as CourtTypeFilter[]).map((t) => {
            const label = t === "ALL" ? "All" : TYPE_META[t]?.label ?? t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${
                  typeFilter === t
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-slate-600 border-slate-300 hover:border-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
          <label className="flex items-center gap-1.5 cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={lightsOnly}
              onChange={(e) => setLightsOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            <Lightbulb className="w-3 h-3 text-amber-500" />
            <span className="text-xs text-slate-600">Lights</span>
          </label>
        </div>
      )}

      {/* ── Result count ── */}
      <p className="text-xs text-slate-500 px-1">
        {isLoading ? "Loading courts…" : `${filtered.length} court${filtered.length !== 1 ? "s" : ""}`}
      </p>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No courts match your filters</p>
          <button onClick={resetFilters} className="text-xs text-primary mt-1 hover:underline">
            Reset filters
          </button>
        </div>
      )}

      {/* ── Court list ── */}
      <div className="space-y-3">
        {filtered.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            selectable={selectable}
            selected={selectedId === court.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
