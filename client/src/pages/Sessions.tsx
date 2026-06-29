import { useState, useMemo } from "react";
import { Link, Redirect } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useSessionHistory, type SessionHistoryItem } from "@/hooks/use-stats";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Star, Calendar, MapPin, Loader2, History } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function avgRating(r: { reliability: number; skillAccuracy: number; partnerQuality: number }): number {
  return Math.round(((r.reliability + r.skillAccuracy + r.partnerQuality) / 3) * 10) / 10;
}

function StarRow({ value, label }: { value: number; label: string }) {
  const avg = value;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-3 h-3 ${avg >= star ? "fill-amber-400 text-amber-400" : avg >= star - 0.5 ? "fill-amber-200 text-amber-400" : "text-slate-200"}`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-amber-600">{avg.toFixed(1)}</span>
    </div>
  );
}

function SessionCard({ item }: { item: SessionHistoryItem }) {
  const partnerName = [item.partnerFirstName, item.partnerLastName].filter(Boolean).join(" ");
  const place = item.courtName ?? item.location;
  const myAvg = item.myRating ? avgRating(item.myRating) : null;
  const theirAvg = item.theirRating ? avgRating(item.theirRating) : null;

  return (
    <Card className="rounded-2xl border-0 shadow-sm bg-white">
      <CardContent className="p-4 md:p-5 space-y-3">
        {/* Header: date + practice type */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">
              {item.scheduledTime
                ? format(new Date(item.scheduledTime), "EEE, MMM d · h:mm a")
                : "Date unknown"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              vs. {partnerName || "Unknown"}
            </p>
          </div>
          {item.practiceType && (
            <Badge variant="secondary" className="shrink-0 text-xs capitalize">
              {item.practiceType}
            </Badge>
          )}
        </div>

        {/* Court / location */}
        {place && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            {place}
          </div>
        )}

        {/* Ratings */}
        {(myAvg !== null || theirAvg !== null) && (
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            {myAvg !== null && <StarRow value={myAvg} label="My rating" />}
            {theirAvg !== null && <StarRow value={theirAvg} label="Their rating" />}
          </div>
        )}

        <div className="pt-1">
          <Link href={`/session/${item.id}`}>
            <span className="text-xs text-primary font-medium hover:underline cursor-pointer">
              View session details →
            </span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Filter helpers ────────────────────────────────────────────────────────────

function toMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMMM yyyy");
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Sessions() {
  const { user } = useAuth();
  const { data: sessions = [], isLoading } = useSessionHistory();

  const [monthFilter, setMonthFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [courtFilter, setCourtFilter] = useState("all");

  if (!user) return <Redirect to="/" />;

  // Derive filter options from session data
  const months = useMemo(() => {
    const keys = new Set<string>();
    sessions.forEach(s => s.scheduledTime && keys.add(toMonthKey(s.scheduledTime)));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [sessions]);

  const partners = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach(s => {
      const name = [s.partnerFirstName, s.partnerLastName].filter(Boolean).join(" ");
      map.set(s.partnerId, name || s.partnerId);
    });
    return Array.from(map.entries());
  }, [sessions]);

  const courtsUsed = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach(s => {
      if (s.courtId && s.courtName) map.set(String(s.courtId), s.courtName);
    });
    return Array.from(map.entries());
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (monthFilter !== "all" && (!s.scheduledTime || toMonthKey(s.scheduledTime) !== monthFilter)) return false;
      if (partnerFilter !== "all" && s.partnerId !== partnerFilter) return false;
      if (courtFilter !== "all" && String(s.courtId) !== courtFilter) return false;
      return true;
    });
  }, [sessions, monthFilter, partnerFilter, courtFilter]);

  const hasFilters = monthFilter !== "all" || partnerFilter !== "all" || courtFilter !== "all";

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <main className="md:pl-64 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <History className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold text-primary">Session History</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {isLoading ? "Loading…" : `${sessions.length} completed session${sessions.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-44 rounded-xl bg-white border shadow-sm text-sm">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map(m => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="w-44 rounded-xl bg-white border shadow-sm text-sm">
                <SelectValue placeholder="All partners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All partners</SelectItem>
                {partners.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {courtsUsed.length > 0 && (
              <Select value={courtFilter} onValueChange={setCourtFilter}>
                <SelectTrigger className="w-48 rounded-xl bg-white border shadow-sm text-sm">
                  <SelectValue placeholder="All courts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courts</SelectItem>
                  {courtsUsed.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Session list */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map(s => <SessionCard key={s.id} item={s} />)}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground bg-white rounded-3xl border border-dashed">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">
                {hasFilters ? "No sessions match your filters" : "No completed sessions yet"}
              </p>
              {!hasFilters && (
                <p className="text-sm mt-1">Sessions you complete will appear here.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
