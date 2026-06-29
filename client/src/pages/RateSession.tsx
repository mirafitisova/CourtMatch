import { useState } from "react";
import { useParams, Redirect, Link } from "wouter";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSession, useMyRating, useSubmitRating } from "@/hooks/use-sessions";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle, ArrowLeft } from "lucide-react";

// ── Star input ────────────────────────────────────────────────────────────────

function StarInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
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
            className={`w-8 h-8 transition-colors ${
              (hover || value) >= star ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const DIMENSIONS = [
  {
    key: "reliability" as const,
    label: "Reliability",
    question: "Did they show up on time?",
  },
  {
    key: "skillAccuracy" as const,
    label: "Skill Accuracy",
    question: "Did their skill match their UTR?",
  },
  {
    key: "partnerQuality" as const,
    label: "Partner Quality",
    question: "Were they a good practice partner?",
  },
];

export default function RateSession() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const sessionId = Number(id);

  const { data: session, isLoading } = useSession(sessionId);
  const { data: existingRating, isLoading: ratingLoading } = useMyRating(sessionId);
  const submitRating = useSubmitRating(sessionId);

  const [scores, setScores] = useState({ reliability: 0, skillAccuracy: 0, partnerQuality: 0 });
  const [note, setNote] = useState("");
  const [bookAgain, setBookAgain] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!user) return <Redirect to="/" />;
  if (isLoading || ratingLoading) {
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

  if (existingRating || submitted) {
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
              {submitted ? "Rating submitted!" : "Already rated"}
            </h1>
            <p className="text-muted-foreground">
              {submitted
                ? goRequest
                  ? `Taking you to ${partner.user?.firstName ?? partnerName}'s profile to book another hit…`
                  : `Thanks for rating your session with ${partnerName}.`
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

  const canSubmit = scores.reliability > 0 && scores.skillAccuracy > 0 && scores.partnerQuality > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    submitRating.mutate(
      { ...scores, note: note.trim() || null },
      { onSuccess: () => setSubmitted(true) }
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
            <p className="text-muted-foreground mt-1">How was your hit with {partnerName}?</p>
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
              ) : (
                "Submit Rating"
              )}
            </Button>

            {!canSubmit && (
              <p className="text-center text-xs text-muted-foreground">
                Rate all three dimensions to submit
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
