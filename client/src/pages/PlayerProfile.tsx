import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import {
  ArrowLeft, BadgeCheck, School, Locate, MapPin,
  Clock, Users, ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvailSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface PlayerDetail {
  userId: string;
  firstName: string | null;
  lastInitial: string | null;
  utrRating: number | null;
  utrVerified: boolean;
  utrProfileUrl: string | null;
  school: string | null;
  grade: number | null;
  teamLevel: string | null;
  handedness: string | null;
  playStyles: string[];
  preferredSurface: string | null;
  playingFrequency: string | null;
  preferredAreas: string[];
  maxDriveMiles: number | null;
  bio: string | null;
  profileCompleteness: number;
  availability: AvailSlot[];
  // Connection signals
  sameSchool: boolean;
  distanceMiles: number | null;
  availabilityOverlapSlots: AvailSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_LABEL: Record<string, string> = {
  "06:00": "Morning",
  "12:00": "Afternoon",
  "17:00": "Evening",
};

function formatLabel(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Availability grid (read-only) ─────────────────────────────────────────────

function AvailGrid({
  slots,
  overlapSlots,
}: {
  slots: AvailSlot[];
  overlapSlots: AvailSlot[];
}) {
  const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun
  const TIMES = ["06:00", "12:00", "17:00"];

  const slotSet = new Set(slots.map((s) => `${s.dayOfWeek}_${s.startTime}`));
  const overlapSet = new Set(overlapSlots.map((s) => `${s.dayOfWeek}_${s.startTime}`));

  return (
    <div>
      {/* Time headers */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-1 mb-1">
        <div />
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-500">
            {DAY_NAMES[d]}
          </div>
        ))}
      </div>
      {TIMES.map((t) => (
        <div key={t} className="grid grid-cols-[40px_repeat(7,1fr)] gap-1 mb-1">
          <div className="text-right pr-1 text-xs text-slate-400 self-center leading-none">
            {TIME_LABEL[t]}
          </div>
          {DAYS.map((d) => {
            const key = `${d}_${t}`;
            const isOverlap = overlapSet.has(key);
            const isSet = slotSet.has(key);
            return (
              <div
                key={key}
                className={`h-7 rounded-md transition-colors ${
                  isOverlap
                    ? "bg-emerald-400 ring-2 ring-emerald-300 ring-offset-1"
                    : isSet
                    ? "bg-primary/70"
                    : "bg-slate-100"
                }`}
                title={
                  isOverlap
                    ? `Both free ${DAY_FULL[d]} ${TIME_LABEL[t]}`
                    : isSet
                    ? `${DAY_FULL[d]} ${TIME_LABEL[t]}`
                    : undefined
                }
              />
            );
          })}
        </div>
      ))}
      {overlapSlots.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700">
          <div className="w-3 h-3 rounded bg-emerald-400" />
          <span>Green = you&apos;re both free</span>
        </div>
      )}
    </div>
  );
}

// ── Connections section ───────────────────────────────────────────────────────

function ConnectionsSection({ player }: { player: PlayerDetail }) {
  const hasAny =
    player.sameSchool || player.distanceMiles !== null || player.availabilityOverlapSlots.length > 0;

  if (!hasAny) return null;

  const overlapDays = (() => {
    if (player.availabilityOverlapSlots.length === 0) return null;
    const days = [...new Set(player.availabilityOverlapSlots.map((s) => s.dayOfWeek))];
    const dayStr = days
      .sort((a, b) => {
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.indexOf(a) - order.indexOf(b);
      })
      .map((d) => DAY_NAMES[d])
      .join(", ");
    return dayStr;
  })();

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-slate-800 text-sm">Your Connection</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {player.sameSchool && player.school && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <School className="w-4 h-4 text-emerald-600" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">You both go to {player.school}</p>
              <p className="text-xs text-slate-500">Same school</p>
            </div>
            <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              Same school
            </span>
          </div>
        )}

        {player.distanceMiles !== null && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-blue-600" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                You&apos;re {player.distanceMiles} miles apart
              </p>
              <p className="text-xs text-slate-500">Based on your locations</p>
            </div>
            {player.distanceMiles <= 5 && (
              <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                Nearby
              </span>
            )}
          </div>
        )}

        {player.availabilityOverlapSlots.length > 0 && overlapDays && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  You&apos;re both available on {overlapDays}
                </p>
                <p className="text-xs text-slate-500">
                  {player.availabilityOverlapSlots.length} overlapping time slot
                  {player.availabilityOverlapSlots.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <AvailGrid
              slots={player.availability}
              overlapSlots={player.availabilityOverlapSlots}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlayerProfile() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: player, isLoading, isError } = useQuery<PlayerDetail>({
    queryKey: ["player", params.id],
    queryFn: () => apiRequest("GET", `/api/player/${params.id}`).then((r) => r.json()),
    enabled: !!params.id,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="md:pl-64 flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isError || !player) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="md:pl-64 flex items-center justify-center min-h-screen text-slate-500">
          <div className="text-center">
            <p className="text-lg font-medium">Player not found</p>
            <Button variant="ghost" className="mt-3" onClick={() => navigate("/search")}>
              Back to search
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="md:pl-64 pb-20">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-16 md:top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/search")}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-slate-800">
            {player.firstName} {player.lastInitial}.
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0 select-none">
              {player.firstName?.[0] ?? "?"}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-800">
                {player.firstName} {player.lastInitial}.
              </h1>

              {/* UTR */}
              {player.utrRating != null && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-sm font-mono font-semibold">
                    UTR {player.utrRating.toFixed(1)}
                  </span>
                  {player.utrVerified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      Verified UTR
                    </span>
                  )}
                </div>
              )}

              {/* Trust badges row */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {player.sameSchool && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <School className="w-3 h-3" />
                    Same school
                  </span>
                )}
                {player.distanceMiles !== null && player.distanceMiles <= 5 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    <Locate className="w-3 h-3" />
                    Nearby
                  </span>
                )}
              </div>

              {/* School + grade */}
              {(player.school || player.grade) && (
                <p className="text-sm text-slate-500 mt-2">
                  {[
                    player.school,
                    player.grade ? `Grade ${player.grade}` : null,
                    player.teamLevel ? formatLabel(player.teamLevel) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          {/* Bio */}
          {player.bio && (
            <p className="mt-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              {player.bio}
            </p>
          )}

          {/* CTA */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button
              className="w-full"
              onClick={() => (window.location.href = `/requests?request=${player.userId}`)}
            >
              Send Hit Request
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Connections section — trust signals */}
        <ConnectionsSection player={player} />

        {/* Play preferences */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            Play Style
          </h2>

          {player.playStyles.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Practice types</p>
              <div className="flex flex-wrap gap-1.5">
                {player.playStyles.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium"
                  >
                    {formatLabel(s)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {player.preferredSurface && (
              <div>
                <p className="text-xs text-slate-500">Surface</p>
                <p className="font-medium text-slate-700 mt-0.5">
                  {formatLabel(player.preferredSurface)}
                </p>
              </div>
            )}
            {player.playingFrequency && (
              <div>
                <p className="text-xs text-slate-500">Frequency</p>
                <p className="font-medium text-slate-700 mt-0.5">{player.playingFrequency}</p>
              </div>
            )}
            {player.handedness && (
              <div>
                <p className="text-xs text-slate-500">Plays</p>
                <p className="font-medium text-slate-700 mt-0.5">
                  {formatLabel(player.handedness)}-handed
                </p>
              </div>
            )}
            {player.maxDriveMiles && (
              <div>
                <p className="text-xs text-slate-500">Will drive up to</p>
                <p className="font-medium text-slate-700 mt-0.5">{player.maxDriveMiles} miles</p>
              </div>
            )}
          </div>

          {player.preferredAreas.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Preferred areas</p>
              <div className="flex flex-wrap gap-1.5">
                {player.preferredAreas.map((a) => (
                  <span
                    key={a}
                    className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Full availability */}
        {player.availability.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">Weekly Availability</h2>
            <AvailGrid
              slots={player.availability}
              overlapSlots={player.availabilityOverlapSlots}
            />
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
