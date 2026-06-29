import { useState } from "react";
import { useParams, Redirect, Link } from "wouter";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSession, useMyRating, useSubmitRating } from "@/hooks/use-sessions";
import { useMyCourtReview, useSubmitCourtReview } from "@/hooks/use-court-reviews";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle, ArrowLeft, MapPin } from "lucide-react";

// ── Star input ────────────────────────────────────────────────────────────────

function StarInput({
  value,
  onChange,
  size = "lg",
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "lg";
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const sz = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed"
        >
          <Star
            className={`${sz} transition-colors ${
              (hover || value) >= star ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Toggle chip ───────────────────────────────────────────────────────────────

function ToggleChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
        active
          ? "bg-primary text-white border-primary shadow-sm"
          : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
      }`}
    >
      {active ? "✓ " : ""}{label}
    </button>
  );
}

// ── Dimensions for partner rating ─────────────────────────────────────────────

const DIMENSIONS = [
  { key: "reliability" as const,    label: "Reliability",    question: "Did they show up on time?" },
  { key: "skillAccuracy" as const,  label: "Skill Accuracy", question: "Did their skill match their UTR?" },
  { key: "partnerQuality" as const, label: "Partner Quality",question: "Were they a good practice partner?" },
];

const COURT_TOGGLES: Array<{ key: keyof CourtToggles; label: string }> = [
  { key: "netsGood",     label: "Nets were good" },
  { key: "surfaceClean", label: "Surface was clean" },
  { key: "notCrowded",   label: "Not too crowded" },
  { key: "goodLighting", label: "Good lighting" },
  { key: "easyParking",  label: "Easy parking" },
];

interface CourtToggles {
  netsGood: boolean;
  surfaceClean: boolean;
  notCrowded: boolean;
  goodLighting: boolean;
  easyParking: boolean;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RateSession() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const sessionId = Number(id);

  const { data: session, isLoading } = useSession(sessionId);
  const { data: existingRating, isLoading: ratingLoading } = useMyRating(sessionId);
  const { data: existingCourtReview, isLoading: courtReviewLoading } = useMyCourtReview(sessionId);
  const submitRating = useSubmitRating(sessionId);
  const submitCourtReview = useSubmitCourtReview(sessionId);

  // Partner rating state
  const [scores, setScores] = useState({ reliability: 0, skillAccuracy: 0, partnerQuality: 0 });
  const [note, setNote] = useState("");
  const [bookAgain, setBookAgain] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Court review state
  const [courtDone, setCourtDone] = useState(false);
  const [courtRating, setCourtRating] = useState(0);
  const [courtToggles, setCourtToggles] = useState<CourtToggles>({
    netsGood: false, surfaceClean: false, notCrowded: false, goodLighting: false, easyParking: false,
  });
  const [courtNote, setCourtNote] = useState("");
  const [firstTime, setFirstTime] = useState(false);

  if (!user) return <Redirect to="/" />;

  if (isLoading || ratingLoading || courtReviewLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <main className="md:pl-64 flex items-center justify-center pt-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!session || (session.requesterId !== user.id && session.receiverId !== user.id)) {
    return <Redirect to="/requests" />;
  }

  const isRequester = session.requesterId === user.id;
  const partner = isRequester ? session.receiver : session.requester;
  const partnerName = `${partner.user?.firstName ?? ""} ${partner.user?.lastName ?? ""}`.trim();
  const partnerId = isRequester ? session.receiverId : session.requesterId;

  const partnerRated = !!(existingRating || submitted);
  const courtAlreadyReviewed = existingCourtReview !== null && existingCourtReview !== undefined;
  const hasCourt = !!session.courtId;

  // Whether we should show the court review form (after partner rating, before done)
  const showCourtStep = partnerRated && hasCourt && !courtAlreadyReviewed && !courtDone;
  // Whether we're fully done
  const showSuccess = partnerRated && (!hasCourt || courtAlreadyReviewed || courtDone);

  // ── Success state ──────────────────────────────────────────────────────────
  if (showSuccess) {
    const goRequest = bookAgain && submitted;
    if (goRequest) {
      setTimeout(() => navigate(`/player/${partnerId}`), 800);
    }
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <main className="md:pl-64 pb-20">
          <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <h1 className="font-display text-2xl font-bold text-primary">
              {submitted ? "All done!" : "Already rated"}
            </h1>
            <p className="text-muted-foreground">
              {submitted
                ? goRequest
                  ? `Taking you to ${partner.user?.firstName ?? partnerName}'s profile to book another hit…`
                  : `Thanks for rating your session${courtDone ? " and the court" : ""}.`
                : `You've already rated this session with ${partnerName}.`}
            </p>
            {!goRequest && (
              <Button className="rounded-xl mt-2" onClick={() => navigate(`/session/${sessionId}`)}>
                Back to session
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── Court review step ──────────────────────────────────────────────────────
  if (showCourtStep) {
    const courtName = (session as any).court?.name ?? "the court";

    function handleCourtSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (courtRating === 0) return;
      submitCourtReview.mutate(
        {
          overallRating: courtRating,
          ...courtToggles,
          note: courtNote,
          firstTime,
        },
        { onSuccess: () => setCourtDone(true) },
      );
    }

    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <main className="md:pl-64 pb-20">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold text-primary">How was {courtName}?</h1>
              <p className="text-sm text-muted-foreground">
                Your review helps other junior players find the best courts.
              </p>
            </div>

            <form onSubmit={handleCourtSubmit} className="space-y-4">
              {/* Overall star rating */}
              <Card className="border-0 shadow-sm rounded-3xl bg-white">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <p className="font-semibold text-sm text-slate-800">Overall rating</p>
                  <StarInput value={courtRating} onChange={setCourtRating} />
                  {courtRating > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {["", "Poor", "Fair", "Good", "Very good", "Excellent"][courtRating]}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Toggles */}
              <Card className="border-0 shadow-sm rounded-3xl bg-white">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <p className="font-semibold text-sm text-slate-800">What stood out? <span className="text-muted-foreground font-normal">(select all that apply)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {COURT_TOGGLES.map(({ key, label }) => (
                      <ToggleChip
                        key={key}
                        label={label}
                        active={courtToggles[key]}
                        onToggle={() => setCourtToggles(t => ({ ...t, [key]: !t[key] }))}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Note */}
              <Card className="border-0 shadow-sm rounded-3xl bg-white">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <div>
                    <p className="font-semibold text-sm text-slate-800">Note <span className="text-muted-foreground font-normal">(optional · max 140 chars)</span></p>
                  </div>
                  <Textarea
                    value={courtNote}
                    onChange={(e) => setCourtNote(e.target.value)}
                    placeholder="The surface was in great shape, lights were bright…"
                    maxLength={140}
                    rows={2}
                    className="rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none text-sm"
                  />
                  {courtNote.length > 0 && (
                    <p className="text-xs text-muted-foreground text-right">{courtNote.length}/140</p>
                  )}
                </CardContent>
              </Card>

              {/* First time? */}
              <Card className="border-0 shadow-sm rounded-3xl bg-white">
                <CardContent className="pt-4 pb-4">
                  <label className="flex items-center gap-4 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setFirstTime(v => !v)}
                      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${firstTime ? "bg-primary" : "bg-slate-200"}`}
                      role="switch"
                      aria-checked={firstTime}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${firstTime ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                    <p className="font-semibold text-sm text-slate-800">First time at this court?</p>
                  </label>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl h-12"
                  onClick={() => setCourtDone(true)}
                >
                  Skip
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-xl h-12 font-semibold"
                  disabled={courtRating === 0 || submitCourtReview.isPending}
                >
                  {submitCourtReview.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Review"}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ── Partner rating form (default) ──────────────────────────────────────────
  const canSubmit = scores.reliability > 0 && scores.skillAccuracy > 0 && scores.partnerQuality > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    submitRating.mutate(
      { ...scores, note: note.trim() || null },
      { onSuccess: () => setSubmitted(true) },
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <main className="md:pl-64 pb-20">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-5">

          <Link href={`/session/${sessionId}`}>
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to session
            </button>
          </Link>

          <div>
            <h1 className="font-display text-2xl font-bold text-primary">Rate your session</h1>
            <p className="text-muted-foreground mt-1">
              How was your hit with {partnerName}?
              {hasCourt && (
                <span className="text-xs ml-2 text-slate-400">Step 1 of 2</span>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Star dimensions */}
            <Card className="border-0 shadow-sm rounded-3xl bg-white">
              <CardContent className="pt-5 pb-5 divide-y divide-slate-50">
                {DIMENSIONS.map(({ key, label, question }, i) => (
                  <div key={key} className={`space-y-2.5 ${i > 0 ? "pt-5" : ""} ${i < DIMENSIONS.length - 1 ? "pb-5" : ""}`}>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{label}</p>
                      <p className="text-xs text-muted-foreground">{question}</p>
                    </div>
                    <StarInput
                      value={scores[key]}
                      onChange={(v) => setScores((s) => ({ ...s, [key]: v }))}
                      disabled={submitRating.isPending}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Optional note */}
            <Card className="border-0 shadow-sm rounded-3xl bg-white">
              <CardContent className="pt-5 pb-5 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-slate-800">
                    Feedback for {partner.user?.firstName ?? "your partner"}
                  </p>
                  <p className="text-xs text-muted-foreground">Optional · max 140 characters</p>
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Great rallies! Very punctual…"
                  maxLength={140}
                  rows={3}
                  className="rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none text-sm"
                />
                {note.length > 0 && (
                  <p className="text-xs text-muted-foreground text-right">{note.length}/140</p>
                )}
              </CardContent>
            </Card>

            {/* Book again toggle */}
            <Card className="border-0 shadow-sm rounded-3xl bg-white">
              <CardContent className="pt-5 pb-5">
                <label className="flex items-center gap-4 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setBookAgain((b) => !b)}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${
                      bookAgain ? "bg-primary" : "bg-slate-200"
                    }`}
                    role="switch"
                    aria-checked={bookAgain}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        bookAgain ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">
                      Hit with {partner.user?.firstName ?? partnerName} again?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Takes you to their profile to send a new hit request after submitting
                    </p>
                  </div>
                </label>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full rounded-xl h-12 font-semibold text-base"
              disabled={!canSubmit || submitRating.isPending}
            >
              {submitRating.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : hasCourt ? (
                "Next: Rate the court →"
              ) : (
                "Submit Rating"
              )}
            </Button>

            {!canSubmit && (
              <p className="text-center text-xs text-muted-foreground">
                Rate all three dimensions to continue
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
