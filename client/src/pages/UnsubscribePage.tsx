import { useEffect, useState } from "react";
import { useSearch, Link } from "wouter";
import { Trophy, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<string, string> = {
  all: "all emails",
  reengagement: "activity reminders",
  marketing: "tournament & marketing emails",
  session_reminders: "session reminders",
};

export default function UnsubscribePage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";
  const type = params.get("type") ?? "all";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`)
      .then(r => r.ok ? setStatus("success") : setStatus("error"))
      .catch(() => setStatus("error"));
  }, [token, type]);

  const label = TYPE_LABELS[type] ?? "these emails";

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-5">
      <div className="max-w-sm w-full text-center space-y-5">
        <Link href="/">
          <div className="flex items-center justify-center gap-2 font-display font-bold text-xl text-primary mb-8">
            <Trophy className="w-6 h-6 text-accent" />
            <span>JuniorHit</span>
          </div>
        </Link>

        {status === "loading" && (
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <h1 className="text-2xl font-display font-bold text-slate-900">
              Unsubscribed
            </h1>
            <p className="text-slate-500">
              You've been unsubscribed from <strong>{label}</strong> from JuniorHit.
            </p>
            <p className="text-sm text-slate-400">
              You can re-enable email notifications at any time in your profile settings.
            </p>
            <Link href="/profile">
              <Button variant="outline" className="rounded-xl mt-2">
                Manage Email Preferences
              </Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-14 h-14 text-destructive mx-auto" />
            <h1 className="text-2xl font-display font-bold text-slate-900">
              Invalid Link
            </h1>
            <p className="text-slate-500">
              This unsubscribe link is invalid or has expired.
            </p>
            <Link href="/profile">
              <Button variant="outline" className="rounded-xl mt-2">
                Manage Email Preferences
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
