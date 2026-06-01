import { useState, useRef, useEffect } from "react";
import { useParams, Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSession, useSessionMessages, useSendSessionMessage, useCancelSession, useCheckin, useMarkNoShow, useMyRating } from "@/hooks/use-sessions";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar, Clock, MapPin, User, Trophy, School, Loader2,
  CalendarPlus, ExternalLink, MessageSquare, Send, X, ArrowLeft,
  Navigation2, CheckCircle, AlertCircle, Star,
} from "lucide-react";
import { format } from "date-fns";

// ── ICS helpers ───────────────────────────────────────────────────────────────

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildIcs(session: any, partnerName: string): string {
  const start = new Date(session.scheduledTime);
  const end = new Date(start.getTime() + 90 * 60_000);
  const loc = session.court
    ? `${session.court.name}, ${session.court.address}`
    : session.location ?? "";
  const courtLabel = session.court?.name ?? session.location ?? "";
  const practice = session.practiceType ?? "Hit session";
  const desc = `Practice type: ${practice}.${courtLabel ? `\\nCourt: ${courtLabel}.` : ""}`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CourtMatch//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${session.id}-${start.getTime()}@courtmatch`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:JuniorHit: Hit with ${partnerName}`,
    loc ? `LOCATION:${loc.replace(/\n/g, "\\n")}` : "",
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function buildGoogleCalUrl(session: any, partnerName: string): string {
  const start = new Date(session.scheduledTime);
  const end = new Date(start.getTime() + 90 * 60_000);
  const loc = session.court
    ? `${session.court.name}, ${session.court.address}`
    : session.location ?? "";
  const courtLabel = session.court?.name ?? session.location ?? "";
  const practice = session.practiceType ?? "Hit session";
  const details = `Practice type: ${practice}.${courtLabel ? ` Court: ${courtLabel}.` : ""}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `JuniorHit: Hit with ${partnerName}`,
    dates: `${icsDate(start)}/${icsDate(end)}`,
    details,
    ...(loc ? { location: loc } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildMapsUrl(session: any): string | null {
  const addr = session.court?.address ?? session.location ?? null;
  if (!addr) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

// ── Cost split display ────────────────────────────────────────────────────────

const COST_LABELS: Record<string, string> = {
  "Split 50/50": "Split 50/50",
  "I'll cover": "Your partner covers",
  "You cover": "You cover",
  "Free court": "Free court",
};

function costLabel(raw: string, isRequester: boolean): string {
  if (raw === "I'll cover") return isRequester ? "You're covering the cost" : "Your partner is covering";
  if (raw === "You cover") return isRequester ? "Your partner covers" : "You're covering the cost";
  return COST_LABELS[raw] ?? raw;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const sessionId = Number(id);

  const { data: session, isLoading } = useSession(sessionId);
  const { data: messages = [], isLoading: msgsLoading } = useSessionMessages(sessionId);
  const sendMessage = useSendSessionMessage(sessionId);
  const cancelSession = useCancelSession(sessionId);
  const checkin = useCheckin(sessionId);
  const markNoShow = useMarkNoShow(sessionId);
  const { data: myRating } = useMyRating(sessionId);

  const [msgText, setMsgText] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) return <Redirect to="/" />;
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <main className="md:pl-64 pb-20 flex items-center justify-center pt-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </main>
      </div>
    );
  }
  if (!session || (session.requesterId !== user.id && session.receiverId !== user.id)) {
    return <Redirect to="/requests" />;
  }

  const isRequester = session.requesterId === user.id;
  const me = isRequester ? session.requester : session.receiver;
  const partner = isRequester ? session.receiver : session.requester;
  const partnerName = `${partner.user?.firstName ?? ""} ${partner.user?.lastName ?? ""}`.trim();
  const mapsUrl = buildMapsUrl(session);
  const cancelled = session.status === "cancelled";

  // Check-in window: 30 min before → 2 hours after start
  const scheduledAt = session.scheduledTime ? new Date(session.scheduledTime) : null;
  const minsUntilSession = scheduledAt ? (scheduledAt.getTime() - Date.now()) / 60_000 : null;
  const inCheckinWindow =
    minsUntilSession !== null &&
    minsUntilSession <= 30 &&
    minsUntilSession > -120 &&
    session.status === "accepted";

  const myCheckinAt = isRequester ? session.checkinRequesterAt : session.checkinReceiverAt;
  const partnerCheckinAt = isRequester ? session.checkinReceiverAt : session.checkinRequesterAt;
  const iCheckedIn = !!myCheckinAt;
  const partnerCheckedIn = !!partnerCheckinAt;
  const bothCheckedIn = iCheckedIn && partnerCheckedIn;
  const canMarkNoShow = iCheckedIn && minsUntilSession !== null && minsUntilSession < -20 && !partnerCheckedIn;

  function handleDownloadIcs() {
    const ics = buildIcs(session, partnerName);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `juniorhit-${partnerName.replace(/\s+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgText.trim()) return;
    sendMessage.mutate(msgText.trim(), {
      onSuccess: () => setMsgText(""),
    });
  }

  function handleCheckin() {
    if ("geolocation" in navigator) {
      setLocLoading(true);
      navigator.geolocation.getCurrentPosition(
        () => { setLocLoading(false); checkin.mutate(true); },
        () => { setLocLoading(false); checkin.mutate(false); },
        { timeout: 8000 }
      );
    } else {
      checkin.mutate(false);
    }
  }

  function handleCancel() {
    cancelSession.mutate(cancelReason, {
      onSuccess: () => setCancelOpen(false),
    });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <main className="md:pl-64 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-5">

          {/* Back */}
          <Link href="/requests">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /> Hit Requests
            </button>
          </Link>

          {/* Cancelled banner */}
          {cancelled && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
              <p className="font-semibold text-red-700">Session Cancelled</p>
              {session.cancelReason && (
                <p className="text-sm text-red-600 mt-1">Reason: {session.cancelReason}</p>
              )}
            </div>
          )}

          {/* No-show banner */}
          {session.status === "no_show" && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-700">No-Show Recorded</p>
                <p className="text-sm text-orange-600 mt-1">
                  A player was marked as a no-show for this session.
                </p>
              </div>
            </div>
          )}

          {/* ── Confirmation card ──────────────────────────────────────────── */}
          <Card className="border-0 shadow-sm rounded-3xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-xl text-primary">Session Details</CardTitle>
                <Badge className={`border-0 font-semibold px-3 py-1 text-xs capitalize
                  ${session.status === "accepted" ? "bg-green-100 text-green-700" : ""}
                  ${cancelled ? "bg-red-100 text-red-700" : ""}
                `}>
                  {session.status === "accepted" ? "Confirmed" : session.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-semibold">
                      {session.scheduledTime
                        ? format(new Date(session.scheduledTime), "EEE, MMM d, yyyy")
                        : <span className="text-muted-foreground italic">TBD</span>}
                    </p>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Time</p>
                    <p className="text-sm font-semibold">
                      {session.scheduledTime
                        ? format(new Date(session.scheduledTime), "h:mm a")
                        : <span className="text-muted-foreground italic">TBD</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Court / Location */}
              <div className="bg-muted/50 rounded-xl p-3 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Court</p>
                  {session.court ? (
                    <>
                      <p className="text-sm font-semibold">{session.court.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{session.court.address}</p>
                    </>
                  ) : session.location ? (
                    <p className="text-sm font-semibold">{session.location}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">TBD</p>
                  )}
                </div>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer"
                    className="shrink-0 text-primary hover:underline text-xs flex items-center gap-1 mt-0.5">
                    Map <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Partner */}
              <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2.5">
                <User className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Hitting with</p>
                  <p className="text-sm font-semibold">{partnerName || "—"}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {partner.profile?.utrRating && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> UTR {partner.profile.utrRating}
                      </span>
                    )}
                    {partner.profile?.school && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <School className="w-3 h-3" /> {partner.profile.school}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Practice type & cost */}
              {(session.practiceType || session.costSplit) && (
                <div className="grid grid-cols-2 gap-3">
                  {session.practiceType && (
                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground">Practice type</p>
                      <p className="text-sm font-semibold">{session.practiceType}</p>
                    </div>
                  )}
                  {session.costSplit && (
                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground">Cost</p>
                      <p className="text-sm font-semibold">{costLabel(session.costSplit, isRequester)}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Calendar buttons ───────────────────────────────────────────── */}
          {session.scheduledTime && !cancelled && (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={handleDownloadIcs}
              >
                <CalendarPlus className="w-4 h-4" /> Add to Calendar (.ics)
              </Button>
              <a href={buildGoogleCalUrl(session, partnerName)} target="_blank" rel="noreferrer">
                <Button variant="outline" className="rounded-xl gap-2">
                  <ExternalLink className="w-4 h-4" /> Google Calendar
                </Button>
              </a>
            </div>
          )}

          {/* ── Check-in ──────────────────────────────────────────────────── */}
          {inCheckinWindow && (
            <Card className={`border-0 shadow-sm rounded-3xl ${bothCheckedIn ? "bg-green-50" : "bg-white"}`}>
              <CardContent className="pt-5 pb-5 space-y-4">
                {bothCheckedIn ? (
                  <div className="text-center py-2">
                    <p className="text-3xl mb-2">🎾</p>
                    <p className="font-bold text-green-700 text-lg">You're both here!</p>
                    <p className="text-sm text-green-600 mt-1">Enjoy your session with {partnerName}.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-700 flex items-center gap-2">
                        <Navigation2 className="w-4 h-4 text-primary" /> Check-In
                      </p>
                      {iCheckedIn && (
                        <span className="text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> You're here
                        </span>
                      )}
                    </div>
                    {!iCheckedIn && (
                      <Button
                        className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold gap-2 h-12 text-base"
                        onClick={handleCheckin}
                        disabled={checkin.isPending || locLoading}
                      >
                        {(checkin.isPending || locLoading)
                          ? <Loader2 className="w-5 h-5 animate-spin" />
                          : <Navigation2 className="w-5 h-5" />}
                        I'm Here
                      </Button>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${partnerCheckedIn ? "bg-green-500" : "bg-slate-300"}`} />
                      {partnerCheckedIn
                        ? `${partnerName} has checked in`
                        : `Waiting for ${partnerName} to check in…`}
                    </div>
                    {canMarkNoShow && (
                      <Button
                        variant="ghost"
                        className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm"
                        onClick={() => markNoShow.mutate()}
                        disabled={markNoShow.isPending}
                      >
                        {markNoShow.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {partnerName} didn't show up
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Session messages ───────────────────────────────────────────── */}
          <Card className="border-0 shadow-sm rounded-3xl bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg text-primary flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> Quick Messages
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Logistics only — "I'll be 5 min late", "Bringing extra balls", etc.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-72 overflow-y-auto mb-4 pr-1">
                {msgsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    No messages yet. Say hi!
                  </p>
                ) : (
                  messages.map((msg: any) => {
                    const isMe = msg.senderId === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm
                          ${isMe
                            ? "bg-primary text-white rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {!isMe && (
                            <p className="text-[11px] font-semibold opacity-70 mb-0.5">
                              {msg.senderFirstName}
                            </p>
                          )}
                          <p>{msg.content}</p>
                          <p className={`text-[10px] mt-0.5 ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                            {msg.createdAt ? format(new Date(msg.createdAt), "h:mm a") : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {!cancelled && (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="rounded-xl shrink-0"
                    disabled={!msgText.trim() || sendMessage.isPending}
                  >
                    {sendMessage.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* ── Rate session prompt ───────────────────────────────────────── */}
          {session.status === "accepted" && scheduledAt && scheduledAt < new Date() && !myRating && (
            <Link href={`/session/${sessionId}/rate`}>
              <button className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-left hover:bg-amber-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-4 h-4 text-amber-300" />
                    ))}
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">How was your session?</p>
                    <p className="text-xs text-amber-600">Rate your hit with {partnerName} →</p>
                  </div>
                </div>
              </button>
            </Link>
          )}
          {myRating && !cancelled && (
            <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              You've rated this session
            </div>
          )}

          {/* ── Cancel button ──────────────────────────────────────────────── */}
          {!cancelled && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm"
                onClick={() => setCancelOpen(true)}
              >
                <X className="w-4 h-4 mr-1.5" /> Cancel Session
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Cancel this session?</DialogTitle>
            <DialogDescription>
              This will notify {partner.user?.firstName ?? "your partner"}. You can add a reason below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Textarea
              placeholder="Reason (optional) — e.g. Family conflict, injury..."
              className="rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none"
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setCancelOpen(false)}
              >
                Never mind
              </Button>
              <Button
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600"
                onClick={handleCancel}
                disabled={cancelSession.isPending}
              >
                {cancelSession.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : "Yes, cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
