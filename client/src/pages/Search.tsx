import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/Navigation";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  MapPin, Clock, ChevronDown, SlidersHorizontal, X,
  BadgeCheck, School, Locate, Link2, ChevronUp, UserCircle,
  ArrowUpDown, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchResult {
  userId: string;
  firstName: string | null;
  lastInitial: string | null;
  utrRating: number | null;
  utrVerified: boolean;
  school: string | null;
  distanceMiles: number | null;
  playStyles: string[];
  preferredAreas: string[];
  availabilityOverlapSlots: { dayOfWeek: number; startTime: string; endTime: string }[];
  availabilityOverlapText: string;
  compatibilityScore: number;
  sameSchool: boolean;
  nearbyPlayer: boolean;
}

interface PlayerProfile {
  profileCompleteness: number;
  utrRating: number | null;
}

// ── Filter / sort state ───────────────────────────────────────────────────────

interface Filters {
  minUtr: number;
  maxUtr: number;
  maxDistance: number;
  practiceTypes: string[];
  dayFilter: string;
}

const DEFAULT_FILTERS: Filters = {
  minUtr: 1,
  maxUtr: 16,
  maxDistance: 25,
  practiceTypes: [],
  dayFilter: "any",
};

type SortKey = "compatibility" | "distance" | "utr";
type QuickFilterKey = "today" | "weekend" | "nearby";

const PRACTICE_TYPES = [
  { value: "MATCH_PLAY", label: "Match Play" },
  { value: "DRILLING", label: "Drilling" },
  { value: "SERVING", label: "Serving" },
  { value: "FITNESS", label: "Fitness" },
];

const DAY_OPTIONS = [
  { value: "any", label: "Any day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function countActiveFilters(f: Filters, qf: Set<QuickFilterKey>): number {
  let n = 0;
  if (f.minUtr !== DEFAULT_FILTERS.minUtr) n++;
  if (f.maxUtr !== DEFAULT_FILTERS.maxUtr) n++;
  if (f.maxDistance !== DEFAULT_FILTERS.maxDistance) n++;
  if (f.practiceTypes.length > 0) n++;
  if (f.dayFilter !== "any") n++;
  n += qf.size;
  return n;
}

function applyQuickFilters(base: Filters, qf: Set<QuickFilterKey>): Filters {
  const out = { ...base };
  if (qf.has("today")) out.dayFilter = String(new Date().getDay());
  else if (qf.has("weekend")) out.dayFilter = "weekends";
  if (qf.has("nearby")) out.maxDistance = 5;
  return out;
}

function sortResults(
  results: SearchResult[],
  sort: SortKey,
  myUtr: number | null,
): SearchResult[] {
  if (sort === "compatibility") return results; // server already sorted
  const arr = [...results];
  if (sort === "distance") {
    arr.sort((a, b) => {
      if (a.distanceMiles === null && b.distanceMiles === null) return 0;
      if (a.distanceMiles === null) return 1;
      if (b.distanceMiles === null) return -1;
      return a.distanceMiles - b.distanceMiles;
    });
  } else if (sort === "utr") {
    arr.sort((a, b) => {
      const da =
        a.utrRating !== null && myUtr !== null ? Math.abs(a.utrRating - myUtr) : Infinity;
      const db =
        b.utrRating !== null && myUtr !== null ? Math.abs(b.utrRating - myUtr) : Infinity;
      return da - db;
    });
  }
  return arr;
}

// ── Trust badges ──────────────────────────────────────────────────────────────

function TrustBadges({ player }: { player: SearchResult }) {
  if (!player.sameSchool && !player.nearbyPlayer && !player.utrVerified) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {player.sameSchool && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
          <School className="w-3 h-3" />
          Same school
        </span>
      )}
      {player.nearbyPlayer && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
          <Locate className="w-3 h-3" />
          Nearby
        </span>
      )}
      {player.utrVerified && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200">
          <BadgeCheck className="w-3 h-3" />
          Verified UTR
        </span>
      )}
    </div>
  );
}

// ── Compatibility ring ────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#94a3b8";

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────

function PlayerCard({ player }: { player: SearchResult }) {
  const [, navigate] = useLocation();

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-slate-50"
      onClick={() => navigate(`/player/${player.userId}`)}
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 select-none">
        {player.firstName?.[0] ?? "?"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800">
            {player.firstName} {player.lastInitial}.
          </span>
          {player.utrRating != null && (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-semibold">
              UTR {player.utrRating.toFixed(1)}
            </span>
          )}
          {player.school && (
            <span className="text-xs text-slate-500 truncate">{player.school}</span>
          )}
        </div>

        <TrustBadges player={player} />

        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
          {player.distanceMiles != null && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {player.distanceMiles} mi away
            </span>
          )}
          {player.availabilityOverlapText && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {player.availabilityOverlapText}
            </span>
          )}
        </div>

        {player.playStyles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {player.playStyles.map((s) => (
              <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                {s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 shrink-0">
        <ScoreRing score={player.compatibilityScore} />
        <Button
          size="sm"
          className="text-xs px-3 h-7"
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/requests?request=${player.userId}`;
          }}
        >
          Request
        </Button>
      </div>
    </div>
  );
}

// ── Profile completeness banner ───────────────────────────────────────────────

function ProfileBanner({ completeness }: { completeness: number }) {
  const [, navigate] = useLocation();
  if (completeness >= 100) return null;

  const pct = completeness;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <UserCircle className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          Complete your profile for better matches
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-amber-600 shrink-0">{pct}%</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 text-xs h-8"
        onClick={() => navigate("/profile/setup")}
      >
        Finish
      </Button>
    </div>
  );
}

// ── Sort toggle ───────────────────────────────────────────────────────────────

function SortToggle({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  const opts: { key: SortKey; label: string }[] = [
    { key: "compatibility", label: "Best match" },
    { key: "distance", label: "Closest" },
    { key: "utr", label: "Similar UTR" },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
        {opts.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              value === key
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Quick filters row ─────────────────────────────────────────────────────────

function QuickFiltersRow({
  active,
  onToggle,
}: {
  active: Set<QuickFilterKey>;
  onToggle: (key: QuickFilterKey) => void;
}) {
  const chips: { key: QuickFilterKey; label: string }[] = [
    { key: "today", label: "Available today" },
    { key: "weekend", label: "This weekend" },
    { key: "nearby", label: "Within 5 mi" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
      {chips.map(({ key, label }) => {
        const on = active.has(key);
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              on
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-slate-600 border-slate-300 hover:border-primary hover:text-primary"
            }`}
          >
            <Zap className={`w-3 h-3 ${on ? "text-white" : "text-primary"}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select input value
    }
  };

  return (
    <div className="text-center py-14 px-4">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <MapPin className="w-7 h-7 text-slate-400" />
      </div>
      <p className="text-base font-semibold text-slate-700">No players found</p>
      <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
        No players match your filters. Try expanding your distance or UTR range.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <X className="w-4 h-4" />
          Reset filters
        </Button>
        <Button variant="ghost" onClick={copyLink} className="gap-2 text-slate-600">
          <Link2 className="w-4 h-4" />
          {copied ? "Link copied!" : "Invite a friend"}
        </Button>
      </div>
    </div>
  );
}

// ── Filter panel ──────────────────────────────────────────────────────────────

function FilterPanel({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  const togglePractice = (val: string) => {
    const cur = filters.practiceTypes;
    onChange({
      ...filters,
      practiceTypes: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val],
    });
  };

  return (
    <div className="space-y-5">
      {/* UTR Range */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          UTR Range
        </label>
        <div className="mt-3 px-1">
          <Slider
            min={1}
            max={16}
            step={0.5}
            value={[filters.minUtr, filters.maxUtr]}
            onValueChange={([min, max]) =>
              onChange({ ...filters, minUtr: min, maxUtr: max })
            }
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{filters.minUtr.toFixed(1)}</span>
          <span>{filters.maxUtr.toFixed(1)}</span>
        </div>
      </div>

      {/* Max Distance */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Max Distance
        </label>
        <div className="mt-3 px-1">
          <Slider
            min={5}
            max={50}
            step={5}
            value={[filters.maxDistance]}
            onValueChange={([val]) => onChange({ ...filters, maxDistance: val })}
          />
        </div>
        <div className="text-xs text-slate-500 mt-1">{filters.maxDistance} miles</div>
      </div>

      {/* Practice Type */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Practice Type
        </label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRACTICE_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => togglePractice(value)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                filters.practiceTypes.includes(value)
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-600 border-slate-300 hover:border-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Day Filter */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Availability
        </label>
        <div className="relative mt-2">
          <select
            value={filters.dayFilter}
            onChange={(e) => onChange({ ...filters, dayFilter: e.target.value })}
            className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 pr-8"
          >
            {DAY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 py-1"
      >
        <X className="w-3 h-3" /> Reset all filters
      </button>
    </div>
  );
}

// ── Desktop sidebar wrapper ───────────────────────────────────────────────────

function SidebarPanel({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
        <span className="font-semibold text-sm text-slate-700">Filters</span>
      </div>
      <FilterPanel filters={filters} onChange={onChange} onReset={onReset} />
    </div>
  );
}

// ── Mobile collapsible filter bar ─────────────────────────────────────────────

function MobileFilterDrawer({
  filters,
  quickFilters,
  onChange,
  onReset,
}: {
  filters: Filters;
  quickFilters: Set<QuickFilterKey>;
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = countActiveFilters(filters, quickFilters);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-slate-700">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {count > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">
              {count}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          <FilterPanel filters={filters} onChange={onChange} onReset={onReset} />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Search() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilterKey>>(new Set());
  const [sort, setSort] = useState<SortKey>("compatibility");
  const [page, setPage] = useState(0);

  // Accumulated pages — stored in a ref so it survives re-renders but we also
  // mirror it into state so the component re-renders when it changes.
  const accRef = useRef<SearchResult[]>([]);
  const [, forceUpdate] = useState(0);

  // Effective filters sent to the API (merges quick filters into base filters)
  const effectiveFilters = applyQuickFilters(filters, quickFilters);

  function buildQuery(p: number, ef: Filters): string {
    const params = new URLSearchParams({
      minUtr: String(ef.minUtr),
      maxUtr: String(ef.maxUtr),
      maxDistance: String(ef.maxDistance),
      dayFilter: ef.dayFilter,
      page: String(p),
    });
    if (ef.practiceTypes.length > 0) {
      params.set("practiceTypes", ef.practiceTypes.join(","));
    }
    return `/api/search?${params}`;
  }

  // Player profile — for banner + UTR sort
  const { data: myProfile } = useQuery<PlayerProfile | null>({
    queryKey: ["/api/player-profile"],
    queryFn: () =>
      fetch("/api/player-profile", { credentials: "include" }).then((r) => {
        if (!r.ok) return null;
        return r.json();
      }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Search query — key includes effective filters + page for caching
  const { data, isFetching } = useQuery<{
    results: SearchResult[];
    total: number;
    hasMore: boolean;
    page: number;
  }>({
    queryKey: ["search", effectiveFilters, page],
    queryFn: () =>
      apiRequest("GET", buildQuery(page, effectiveFilters)).then((r) => r.json()),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000, // cache for 5 min → back-nav shows cached instantly
  });

  // Accumulate pages into accRef when new data arrives
  useEffect(() => {
    if (!data) return;
    if (data.page === 0) {
      accRef.current = data.results;
    } else {
      const existing = new Set(accRef.current.map((r) => r.userId));
      const fresh = data.results.filter((r) => !existing.has(r.userId));
      accRef.current = [...accRef.current, ...fresh];
    }
    forceUpdate((n) => n + 1);
  }, [data]);

  // Reset accumulated when filters change
  const resetAcc = () => {
    accRef.current = [];
    setPage(0);
    forceUpdate((n) => n + 1);
  };

  const handleFilterChange = (f: Filters) => {
    resetAcc();
    setFilters(f);
  };

  const handleReset = () => {
    resetAcc();
    setFilters(DEFAULT_FILTERS);
    setQuickFilters(new Set());
  };

  const toggleQuickFilter = (key: QuickFilterKey) => {
    resetAcc();
    setQuickFilters((prev) => {
      const next = new Set(prev);
      // "today" and "weekend" are mutually exclusive with each other
      if (key === "today" && next.has("weekend")) next.delete("weekend");
      if (key === "weekend" && next.has("today")) next.delete("today");
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Displayed: use accRef when populated; fall back to current data page
  const rawDisplayed: SearchResult[] =
    accRef.current.length > 0 ? accRef.current : (data?.results ?? []);

  // Client-side sort
  const displayed = sortResults(rawDisplayed, sort, myProfile?.utrRating ?? null);

  const totalCount = data?.total ?? 0;
  const activeFilterCount = countActiveFilters(filters, quickFilters);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="md:pl-64 pb-20">
      {/* ── Sticky header ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-16 md:top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Find Hitting Partners</h1>
            {data && (
              <p className="text-xs text-slate-500 mt-0.5">
                {totalCount} player{totalCount !== 1 ? "s" : ""} near you
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 flex gap-6 items-start">
        {/* ── Desktop sidebar ── */}
        <aside className="w-60 shrink-0 hidden md:block sticky top-[72px]">
          <SidebarPanel
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
          />
        </aside>

        {/* ── Main column ── */}
        <main className="flex-1 min-w-0 space-y-3">
          {/* Profile completeness banner */}
          {myProfile && myProfile.profileCompleteness < 100 && (
            <ProfileBanner completeness={myProfile.profileCompleteness} />
          )}

          {/* Mobile collapsible filters */}
          <div className="md:hidden">
            <MobileFilterDrawer
              filters={filters}
              quickFilters={quickFilters}
              onChange={handleFilterChange}
              onReset={handleReset}
            />
          </div>

          {/* Quick filters */}
          <QuickFiltersRow active={quickFilters} onToggle={toggleQuickFilter} />

          {/* Sort + result count row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SortToggle value={sort} onChange={setSort} />
            {activeFilterCount > 0 && (
              <button
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-primary flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>

          {/* Loading skeleton */}
          {isFetching && displayed.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Finding players…</p>
            </div>
          )}

          {/* Empty state */}
          {!isFetching && displayed.length === 0 && (
            <EmptyState onReset={handleReset} />
          )}

          {/* Cards */}
          {displayed.map((player) => (
            <PlayerCard key={player.userId} player={player} />
          ))}

          {/* Subtle fetch indicator when loading more */}
          {isFetching && displayed.length > 0 && (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Load more */}
          {!isFetching && data?.hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                className="px-8"
              >
                Load more
              </Button>
            </div>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}
