import { useState, useRef, useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const SCHOOLS = [
  "Burbank High School",
  "John Burroughs High School",
  "Crescenta Valley High School",
  "Glendale High School",
  "Hoover High School",
  "La Cañada High School",
  "Clark Magnet High School",
  "Verdugo Hills High School",
  "Arleta High School",
  "Poly High School",
  "Granada Hills Charter High School",
  "Cleveland High School",
  "Birmingham Community Charter High School",
  "Chatsworth Charter High School",
  "El Camino Real Charter High School",
  "San Fernando High School",
  "James Monroe High School",
  "Sylmar Charter High School",
  "Kennedy High School",
  "Reseda High School",
  "Taft Charter High School",
  "North Hollywood High School",
  "Van Nuys High School",
  "Academy of Tennis (private)",
  "Other / Home School",
];

const PRACTICE_TYPES = [
  { value: "rally", label: "Rally" },
  { value: "match_play", label: "Match play" },
  { value: "serve_practice", label: "Serve practice" },
  { value: "drill_partner", label: "Drill partner" },
  { value: "doubles", label: "Doubles" },
  { value: "tournament_prep", label: "Tournament prep" },
] as const;

const SURFACES = [
  { value: "HARD", label: "Hard court" },
  { value: "CLAY", label: "Clay" },
  { value: "GRASS", label: "Grass" },
  { value: "NO_PREFERENCE", label: "No preference" },
] as const;

const FREQUENCIES = [
  "1–2 times/week",
  "3–4 times/week",
  "5+ times/week",
  "It varies",
] as const;

const DAYS = [
  { label: "Mon", dayOfWeek: 1 },
  { label: "Tue", dayOfWeek: 2 },
  { label: "Wed", dayOfWeek: 3 },
  { label: "Thu", dayOfWeek: 4 },
  { label: "Fri", dayOfWeek: 5 },
  { label: "Sat", dayOfWeek: 6 },
  { label: "Sun", dayOfWeek: 0 },
] as const;

const TIME_BLOCKS = [
  { label: "Morning", sub: "6am–12pm", startTime: "06:00", endTime: "12:00" },
  { label: "Afternoon", sub: "12–5pm", startTime: "12:00", endTime: "17:00" },
  { label: "Evening", sub: "5–9pm", startTime: "17:00", endTime: "21:00" },
] as const;

const PLAY_AREAS = [
  "Burbank",
  "Glendale",
  "Studio City",
  "North Hollywood",
  "Pasadena",
  "Encino",
  "Other",
] as const;

const DRIVE_OPTIONS = [
  { value: "5", label: "5 miles" },
  { value: "10", label: "10 miles" },
  { value: "15", label: "15 miles" },
  { value: "25", label: "25+ miles" },
] as const;

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Unique string key for a grid cell: "dayOfWeek_startTime" e.g. "1_06:00" */
function cellKey(dayOfWeek: number, startTime: string) {
  return `${dayOfWeek}_${startTime}`;
}

function computeCompleteness(
  s1: Step1State,
  s2: Step2State,
  s3: Step3State,
): number {
  const checks = [
    !!s1.utrRating,
    !!s1.school,
    !!s1.grade,
    !!s1.teamLevel,
    !!s1.handedness,
    s2.playStyles.length > 0,
    !!s2.preferredSurface,
    !!s2.bio.trim(),
    !!s2.playingFrequency,
    s3.preferredAreas.length > 0,
    !!s3.maxDriveMiles,
    s3.availableCells.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ── Shared UI primitives ───────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block rounded-full transition-all duration-300 ${
            i === current
              ? "w-8 h-3 bg-primary"
              : i < current
                ? "w-3 h-3 bg-primary/50"
                : "w-3 h-3 bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

function RadioPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-3 rounded-xl border-2 font-medium text-sm transition-all duration-150 select-none ${
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "border-muted bg-muted/30 text-foreground hover:border-primary/40 hover:bg-muted/60"
      }`}
    >
      {label}
    </button>
  );
}

function ToggleChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all duration-150 select-none flex items-center gap-1.5 ${
        selected
          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
          : "border-muted bg-muted/30 text-foreground hover:border-muted-foreground/40 hover:bg-muted/60"
      }`}
    >
      {selected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SelectArrow() {
  return (
    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rotate-90 pointer-events-none" />
  );
}

// ── School autocomplete ────────────────────────────────────────────────────────

function SchoolPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = SCHOOLS.filter((s) =>
    s.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(school: string) {
    setQuery(school);
    onChange(school);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search your school…"
          className="h-14 pl-10 rounded-xl bg-muted/30 border-muted text-base"
        />
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-background border rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((school) => (
              <li key={school}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
                  onMouseDown={() => select(school)}
                >
                  {school}
                </button>
              </li>
            ))
          ) : (
            <li>
              <button
                type="button"
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors rounded-xl"
                onMouseDown={() => select(query)}
              >
                Use &ldquo;{query}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

interface Step1State {
  utrRating: string;
  utrProfileUrl: string;
  school: string;
  grade: string;
  teamLevel: "VARSITY" | "JV" | "NONE" | "";
  handedness: "RIGHT" | "LEFT" | "";
}

function Step1({
  initial,
  onNext,
  isPending,
}: {
  initial: Step1State;
  onNext: (data: Step1State) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<Step1State>(initial);
  const urlProvided = form.utrProfileUrl.trim().length > 0;

  function set<K extends keyof Step1State>(k: K, v: Step1State[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const utrNum = parseFloat(form.utrRating);
  const utrValid =
    !form.utrRating || (!isNaN(utrNum) && utrNum >= 1.0 && utrNum <= 16.5);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext(form);
      }}
      className="space-y-8"
    >
      <Field
        label="UTR Rating"
        hint={
          <span>
            Don&apos;t know your UTR?{" "}
            <a
              href="https://www.utrsports.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 inline-flex items-center gap-1 hover:text-primary/80"
            >
              Look it up at utrsports.net <ExternalLink className="w-3 h-3" />
            </a>
          </span>
        }
      >
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="1.0"
          max="16.5"
          placeholder="e.g. 8.5"
          value={form.utrRating}
          onChange={(e) => set("utrRating", e.target.value)}
          className={`h-14 rounded-xl bg-muted/30 text-base border-muted ${!utrValid ? "border-destructive" : ""}`}
        />
        {!utrValid && (
          <p className="text-xs text-destructive mt-1">
            UTR must be between 1.0 and 16.5
          </p>
        )}
      </Field>

      <Field label="UTR Profile URL (optional)">
        <div className="relative">
          <Input
            type="url"
            placeholder="https://app.utrsports.net/profiles/…"
            value={form.utrProfileUrl}
            onChange={(e) => set("utrProfileUrl", e.target.value)}
            className="h-14 rounded-xl bg-muted/30 text-base border-muted pr-32"
          />
          {urlProvided && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </Badge>
            </span>
          )}
        </div>
      </Field>

      <Field label="School">
        <SchoolPicker value={form.school} onChange={(v) => set("school", v)} />
      </Field>

      <Field label="Grade">
        <div className="relative">
          <select
            value={form.grade}
            onChange={(e) => set("grade", e.target.value)}
            className="w-full h-14 rounded-xl bg-muted/30 border border-muted text-base px-4 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select grade…</option>
            <option value="9">9th Grade</option>
            <option value="10">10th Grade</option>
            <option value="11">11th Grade</option>
            <option value="12">12th Grade</option>
            <option value="graduated">Graduated</option>
          </select>
          <SelectArrow />
        </div>
      </Field>

      <Field label="School Team">
        <div className="flex flex-wrap gap-3">
          {(
            [
              { value: "VARSITY", label: "Varsity" },
              { value: "JV", label: "JV" },
              { value: "NONE", label: "Not on a team" },
            ] as const
          ).map(({ value, label }) => (
            <RadioPill
              key={value}
              label={label}
              selected={form.teamLevel === value}
              onClick={() => set("teamLevel", value)}
            />
          ))}
        </div>
      </Field>

      <Field label="Handedness">
        <div className="flex gap-3">
          {(
            [
              { value: "RIGHT", label: "Right" },
              { value: "LEFT", label: "Left" },
            ] as const
          ).map(({ value, label }) => (
            <RadioPill
              key={value}
              label={label}
              selected={form.handedness === value}
              onClick={() => set("handedness", value)}
            />
          ))}
        </div>
      </Field>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={isPending || !utrValid}
          className="w-full h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
        >
          {isPending ? "Saving…" : <>Next <ChevronRight className="w-5 h-5" /></>}
        </Button>
      </div>
    </form>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

interface Step2State {
  playStyles: string[];
  preferredSurface: "HARD" | "CLAY" | "GRASS" | "NO_PREFERENCE" | "";
  bio: string;
  playingFrequency: string;
}

const BIO_MAX = 280;

function Step2({
  initial,
  onBack,
  onNext,
  isPending,
}: {
  initial: Step2State;
  onBack: () => void;
  onNext: (data: Step2State) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<Step2State>(initial);

  function toggleStyle(value: string) {
    setForm((p) => ({
      ...p,
      playStyles: p.playStyles.includes(value)
        ? p.playStyles.filter((s) => s !== value)
        : [...p.playStyles, value],
    }));
  }

  const charsLeft = BIO_MAX - form.bio.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext(form);
      }}
      className="space-y-8"
    >
      <Field
        label="Practice Types"
        hint="Pick everything that applies — partners will see this."
      >
        <div className="flex flex-wrap gap-2.5 pt-0.5">
          {PRACTICE_TYPES.map(({ value, label }) => (
            <ToggleChip
              key={value}
              label={label}
              selected={form.playStyles.includes(value)}
              onClick={() => toggleStyle(value)}
            />
          ))}
        </div>
      </Field>

      <Field label="Preferred Surface">
        <div className="flex flex-wrap gap-3">
          {SURFACES.map(({ value, label }) => (
            <RadioPill
              key={value}
              label={label}
              selected={form.preferredSurface === value}
              onClick={() => setForm((p) => ({ ...p, preferredSurface: value }))}
            />
          ))}
        </div>
      </Field>

      <Field label="About You (optional)">
        <div className="relative">
          <Textarea
            value={form.bio}
            onChange={(e) => {
              if (e.target.value.length <= BIO_MAX)
                setForm((p) => ({ ...p, bio: e.target.value }));
            }}
            placeholder="Tell potential hitting partners about yourself and what you're working on..."
            className="min-h-[120px] rounded-xl bg-muted/30 border-muted text-base resize-none pb-8"
          />
          <span
            className={`absolute bottom-3 right-4 text-xs font-medium tabular-nums transition-colors ${
              charsLeft <= 40 ? "text-amber-500" : "text-muted-foreground"
            }`}
          >
            {charsLeft}
          </span>
        </div>
      </Field>

      <Field label="How often do you play?">
        <div className="relative">
          <select
            value={form.playingFrequency}
            onChange={(e) =>
              setForm((p) => ({ ...p, playingFrequency: e.target.value }))
            }
            className="w-full h-14 rounded-xl bg-muted/30 border border-muted text-base px-4 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select frequency…</option>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <SelectArrow />
        </div>
      </Field>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 h-14 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" /> Back
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
        >
          {isPending ? "Saving…" : <>Next <ChevronRight className="w-5 h-5" /></>}
        </Button>
      </div>
    </form>
  );
}

// ── Step 3 — Availability grid ─────────────────────────────────────────────────

interface Step3State {
  availableCells: string[]; // "dayOfWeek_startTime" keys
  preferredAreas: string[];
  maxDriveMiles: string;
}

function AvailabilityGrid({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (cells: string[]) => void;
}) {
  function toggle(dayOfWeek: number, startTime: string) {
    const key = cellKey(dayOfWeek, startTime);
    onChange(
      selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    );
  }

  const selectedCount = selected.length;

  return (
    <div>
      {/* Overflow wrapper for narrow screens */}
      <div className="overflow-x-auto -mx-1">
        <div className="min-w-[300px] px-1">
          {/* Day headers */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1">
            <div />
            {DAYS.map((d) => (
              <div
                key={d.dayOfWeek}
                className="text-center text-[11px] font-semibold text-muted-foreground py-1 leading-none"
              >
                {d.label}
              </div>
            ))}
          </div>

          {/* Time block rows */}
          {TIME_BLOCKS.map((block) => (
            <div
              key={block.startTime}
              className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1"
            >
              {/* Row label */}
              <div className="flex flex-col justify-center pr-1.5 py-1">
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  {block.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {block.sub}
                </span>
              </div>

              {/* Cells */}
              {DAYS.map((day) => {
                const active = selected.includes(
                  cellKey(day.dayOfWeek, block.startTime),
                );
                return (
                  <button
                    key={day.dayOfWeek}
                    type="button"
                    aria-label={`${day.label} ${block.label}${active ? " (selected)" : ""}`}
                    aria-pressed={active}
                    onClick={() => toggle(day.dayOfWeek, block.startTime)}
                    className={`h-11 rounded-lg border-2 transition-all duration-150 flex items-center justify-center ${
                      active
                        ? "bg-emerald-100 border-emerald-400"
                        : "bg-muted/40 border-muted hover:border-muted-foreground/30 hover:bg-muted/70"
                    }`}
                  >
                    {active && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 block" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + count */}
      <div className="flex items-center justify-between mt-3 px-0.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-400" />
            <span className="text-xs text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-muted/40 border-2 border-muted" />
            <span className="text-xs text-muted-foreground">Unavailable</span>
          </div>
        </div>
        {selectedCount > 0 && (
          <span className="text-xs font-semibold text-emerald-600">
            {selectedCount} slot{selectedCount !== 1 ? "s" : ""} selected
          </span>
        )}
      </div>
    </div>
  );
}

function Step3({
  initial,
  onBack,
  onComplete,
  isPending,
}: {
  initial: Step3State;
  onBack: () => void;
  onComplete: (data: Step3State) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<Step3State>(initial);

  function toggleArea(area: string) {
    setForm((p) => ({
      ...p,
      preferredAreas: p.preferredAreas.includes(area)
        ? p.preferredAreas.filter((a) => a !== area)
        : [...p.preferredAreas, area],
    }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onComplete(form);
      }}
      className="space-y-8"
    >
      {/* Availability grid */}
      <Field label="Weekly Availability" hint="Tap cells to mark when you're free to hit.">
        <div className="mt-1">
          <AvailabilityGrid
            selected={form.availableCells}
            onChange={(cells) => setForm((p) => ({ ...p, availableCells: cells }))}
          />
        </div>
      </Field>

      {/* Preferred areas */}
      <Field label="Preferred Areas to Play">
        <div className="flex flex-wrap gap-2.5 pt-0.5">
          {PLAY_AREAS.map((area) => (
            <ToggleChip
              key={area}
              label={area}
              selected={form.preferredAreas.includes(area)}
              onClick={() => toggleArea(area)}
            />
          ))}
        </div>
      </Field>

      {/* Drive distance */}
      <Field label="How far are you willing to drive?">
        <div className="flex flex-wrap gap-3">
          {DRIVE_OPTIONS.map(({ value, label }) => (
            <RadioPill
              key={value}
              label={label}
              selected={form.maxDriveMiles === value}
              onClick={() => setForm((p) => ({ ...p, maxDriveMiles: value }))}
            />
          ))}
        </div>
      </Field>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 h-14 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" /> Back
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
        >
          {isPending ? "Finishing up…" : "Complete Profile"}
        </Button>
      </div>
    </form>
  );
}

// ── Completion screen ──────────────────────────────────────────────────────────

function CompletionScreen({
  s1,
  s2,
  s3,
  firstName,
}: {
  s1: Step1State;
  s2: Step2State;
  s3: Step3State;
  firstName: string | null | undefined;
}) {
  const [, setLocation] = useLocation();
  const score = computeCompleteness(s1, s2, s3);

  const gradeLabel: Record<string, string> = {
    "9": "9th Grade",
    "10": "10th Grade",
    "11": "11th Grade",
    "12": "12th Grade",
    graduated: "Graduated",
  };

  const teamLabel: Record<string, string> = {
    VARSITY: "Varsity",
    JV: "JV",
    NONE: "Not on a team",
  };

  const surfaceLabel: Record<string, string> = {
    HARD: "Hard court",
    CLAY: "Clay",
    GRASS: "Grass",
    NO_PREFERENCE: "No preference",
  };

  const availDays = new Set(
    s3.availableCells.map((k) => k.split("_")[0]),
  ).size;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background flex flex-col items-center justify-start pt-16 px-4 pb-16">
      {/* Trophy / celebration icon */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center shadow-lg shadow-emerald-100">
          <Trophy className="w-12 h-12 text-emerald-600" />
        </div>
        <span className="absolute -top-1 -right-1 text-2xl">🎉</span>
      </div>

      <h1 className="text-3xl font-display font-bold text-foreground text-center">
        {firstName ? `You're all set, ${firstName}!` : "Profile Complete!"}
      </h1>
      <p className="text-muted-foreground text-center mt-2 mb-8 max-w-xs">
        Your profile is ready. Start finding hitting partners near you.
      </p>

      {/* Completeness badge */}
      <div className="flex items-center gap-2 mb-8">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="5" />
            <circle
              cx="28"
              cy="28"
              r="22"
              fill="none"
              stroke="#10b981"
              strokeWidth="5"
              strokeDasharray={`${(score / 100) * 138.2} 138.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-700">
            {score}%
          </span>
        </div>
        <div>
          <p className="font-bold text-foreground">Profile completeness</p>
          <p className="text-xs text-muted-foreground">
            {score === 100
              ? "Fully complete!"
              : "Fill in more details to attract partners"}
          </p>
        </div>
      </div>

      {/* Summary card */}
      <div className="w-full max-w-sm bg-background rounded-2xl border shadow-md p-5 space-y-3 mb-8">
        {s1.utrRating && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">UTR Rating</span>
            <span className="font-bold text-primary">{s1.utrRating}</span>
          </div>
        )}
        {s1.school && (
          <div className="flex justify-between items-start gap-4">
            <span className="text-sm text-muted-foreground shrink-0">School</span>
            <span className="font-semibold text-right text-sm">{s1.school}</span>
          </div>
        )}
        {s1.grade && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Grade</span>
            <span className="font-semibold text-sm">{gradeLabel[s1.grade] ?? s1.grade}</span>
          </div>
        )}
        {s1.teamLevel && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Team</span>
            <span className="font-semibold text-sm">{teamLabel[s1.teamLevel]}</span>
          </div>
        )}
        {s2.preferredSurface && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Surface</span>
            <span className="font-semibold text-sm">{surfaceLabel[s2.preferredSurface]}</span>
          </div>
        )}
        {s2.playStyles.length > 0 && (
          <div className="flex justify-between items-start gap-4">
            <span className="text-sm text-muted-foreground shrink-0">Practice</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {s2.playStyles.map((style) => {
                const found = PRACTICE_TYPES.find((p) => p.value === style);
                return (
                  <span
                    key={style}
                    className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full"
                  >
                    {found?.label ?? style}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {s3.availableCells.length > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Availability</span>
            <span className="font-semibold text-sm text-emerald-600">
              {s3.availableCells.length} slot{s3.availableCells.length !== 1 ? "s" : ""} across{" "}
              {availDays} day{availDays !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm space-y-3">
        <Button
          className="w-full h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          onClick={() => setLocation("/players")}
        >
          <Users className="w-5 h-5" />
          Find Hitting Partners
        </Button>
        <Button
          variant="ghost"
          className="w-full h-12 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/profile/setup")}
        >
          Edit profile
        </Button>
      </div>
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export default function ProfileSetupWizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0); // 0-2 = wizard steps, 3 = completion

  const blankStep1: Step1State = {
    utrRating: "",
    utrProfileUrl: "",
    school: "",
    grade: "",
    teamLevel: "",
    handedness: "",
  };
  const blankStep2: Step2State = {
    playStyles: [],
    preferredSurface: "",
    bio: "",
    playingFrequency: "",
  };
  const blankStep3: Step3State = {
    availableCells: [],
    preferredAreas: [],
    maxDriveMiles: "",
  };

  const [step1Data, setStep1Data] = useState<Step1State>(blankStep1);
  const [step2Data, setStep2Data] = useState<Step2State>(blankStep2);
  const [step3Data, setStep3Data] = useState<Step3State>(blankStep3);

  // Load existing player profile
  const { data: existing } = useQuery({
    queryKey: ["/api/player-profile"],
    queryFn: async () => {
      const res = await fetch("/api/player-profile", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!user,
  });

  // Load existing weekly availability
  const { data: existingAvail } = useQuery({
    queryKey: ["/api/weekly-availability"],
    queryFn: async () => {
      const res = await fetch("/api/weekly-availability", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json() as Promise<
        { dayOfWeek: number; startTime: string; endTime: string }[]
      >;
    },
    enabled: !!user,
  });

  // Pre-fill from existing data
  useEffect(() => {
    if (!existing) return;
    setStep1Data({
      utrRating: existing.utrRating != null ? String(existing.utrRating) : "",
      utrProfileUrl: existing.utrProfileUrl ?? "",
      school: existing.school ?? "",
      grade: existing.grade != null ? String(existing.grade) : "",
      teamLevel: existing.teamLevel ?? "",
      handedness: existing.handedness ?? "",
    });
    setStep2Data({
      playStyles: existing.playStyles ?? [],
      preferredSurface: existing.preferredSurface ?? "",
      bio: existing.bio ?? "",
      playingFrequency: existing.playingFrequency ?? "",
    });
    setStep3Data((prev) => ({
      ...prev,
      preferredAreas: existing.preferredAreas ?? [],
      maxDriveMiles: existing.maxDriveMiles != null
        ? String(existing.maxDriveMiles)
        : "",
    }));
  }, [existing]);

  useEffect(() => {
    if (!existingAvail || existingAvail.length === 0) return;
    const cells = existingAvail.map((row: { dayOfWeek: number; startTime: string }) =>
      cellKey(row.dayOfWeek, row.startTime),
    );
    setStep3Data((prev) => ({ ...prev, availableCells: cells }));
  }, [existingAvail]);

  // Profile save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/player-profile"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Availability save mutation (also triggers completeness recalc server-side)
  const saveAvailMutation = useMutation({
    mutationFn: async (
      slots: { dayOfWeek: number; startTime: string; endTime: string }[],
    ) => {
      const res = await fetch("/api/weekly-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player-profile"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!user) return <Redirect to="/" />;

  // ── Step handlers ────────────────────────────────────────────────────────────

  async function handleStep1Next(data: Step1State) {
    setStep1Data(data);
    const payload: Record<string, unknown> = {};
    if (data.utrRating) payload.utrRating = parseFloat(data.utrRating);
    if (data.utrProfileUrl) payload.utrProfileUrl = data.utrProfileUrl;
    if (data.school) payload.school = data.school;
    if (data.grade && data.grade !== "graduated")
      payload.grade = parseInt(data.grade, 10);
    if (data.teamLevel) payload.teamLevel = data.teamLevel;
    if (data.handedness) payload.handedness = data.handedness;
    try {
      await saveMutation.mutateAsync(payload);
      setStep(1);
    } catch {
      /* handled in onError */
    }
  }

  async function handleStep2Next(data: Step2State) {
    setStep2Data(data);
    const payload: Record<string, unknown> = { playStyles: data.playStyles };
    if (data.preferredSurface) payload.preferredSurface = data.preferredSurface;
    if (data.bio.trim()) payload.bio = data.bio.trim();
    if (data.playingFrequency) payload.playingFrequency = data.playingFrequency;
    try {
      await saveMutation.mutateAsync(payload);
      setStep(2);
    } catch {
      /* handled in onError */
    }
  }

  async function handleStep3Complete(data: Step3State) {
    setStep3Data(data);

    // 1. Save preferred areas + drive distance to player profile
    const profilePayload: Record<string, unknown> = {};
    if (data.preferredAreas.length > 0)
      profilePayload.preferredAreas = data.preferredAreas;
    if (data.maxDriveMiles)
      profilePayload.maxDriveMiles = parseInt(data.maxDriveMiles, 10);

    // 2. Convert cell keys back to slot objects
    const slots = data.availableCells.map((key) => {
      const [dayStr, startTime] = key.split("_");
      const block = TIME_BLOCKS.find((b) => b.startTime === startTime)!;
      return {
        dayOfWeek: parseInt(dayStr, 10),
        startTime: block.startTime,
        endTime: block.endTime,
      };
    });

    try {
      if (Object.keys(profilePayload).length > 0) {
        await saveMutation.mutateAsync(profilePayload);
      }
      await saveAvailMutation.mutateAsync(slots);
      setStep(3); // show completion screen
    } catch {
      /* handled in onError */
    }
  }

  const isPending = saveMutation.isPending || saveAvailMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────

  // Completion screen bypasses the wizard chrome entirely
  if (step === 3) {
    return (
      <CompletionScreen
        s1={step1Data}
        s2={step2Data}
        s3={step3Data}
        firstName={user.firstName}
      />
    );
  }

  const STEP_TITLES = [
    "Your Tennis Identity",
    "How You Like to Play",
    "When Can You Play?",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-background/80 backdrop-blur-md border-b z-50 flex items-center px-4 gap-2">
        <Trophy className="w-5 h-5 text-accent" />
        <span className="font-display font-bold text-primary">CourtMatch</span>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-24 pb-16 md:pt-16">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Trophy className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Set Up Your Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Step {step + 1} of 3 — {STEP_TITLES[step]}
          </p>
        </div>

        <StepDots current={step} total={3} />

        <div className="bg-background rounded-3xl border shadow-xl shadow-black/5 px-6 py-8 md:px-10">
          {step === 0 && (
            <Step1
              initial={step1Data}
              onNext={handleStep1Next}
              isPending={isPending}
            />
          )}
          {step === 1 && (
            <Step2
              initial={step2Data}
              onBack={() => setStep(0)}
              onNext={handleStep2Next}
              isPending={isPending}
            />
          )}
          {step === 2 && (
            <Step3
              initial={step3Data}
              onBack={() => setStep(1)}
              onComplete={handleStep3Complete}
              isPending={isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}
