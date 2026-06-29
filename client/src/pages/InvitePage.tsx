import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Calendar, Shield, ArrowRight, Loader2 } from "lucide-react";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();

  const { data: inviter, isLoading, isError } = useQuery<{ firstName: string | null; inviteCode: string }>({
    queryKey: ["/api/invite", code],
    queryFn: async () => {
      const res = await fetch(`/api/invite/${code}`);
      if (!res.ok) throw new Error("Invalid invite");
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  const signupUrl = `/signup?ref=${code}`;
  const inviterName = inviter?.firstName ?? "A friend";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2d1c] to-[#1a4a2e] text-white">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-2 font-display font-bold text-xl">
          <Trophy className="w-6 h-6 text-accent" />
          <span>JuniorHit</span>
        </div>
        <Link href="/auth">
          <Button variant="ghost" className="text-white/70 hover:text-white text-sm">
            Log in
          </Button>
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-5 pb-20 pt-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : isError ? (
          <div className="text-center py-24 space-y-4">
            <p className="text-white/60">This invite link is no longer valid.</p>
            <Link href="/signup">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">
                Sign up anyway →
              </Button>
            </Link>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-10"
          >
            {/* Hero */}
            <div className="text-center space-y-4 pt-4">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">🎾</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold leading-tight">
                {inviterName} invited you to JuniorHit
              </h1>
              <p className="text-lg text-white/70 leading-relaxed max-w-lg mx-auto">
                The platform for junior tennis players to find practice partners at their exact skill level — with verified UTR ratings and parent-approved safety.
              </p>
              <Link href={signupUrl}>
                <Button
                  size="lg"
                  className="h-14 px-10 text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90 rounded-2xl shadow-2xl shadow-accent/20 mt-2"
                  data-testid="button-invite-signup"
                >
                  Join {inviterName} on JuniorHit <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <p className="text-sm text-white/40">Free to join · No credit card required</p>
            </div>

            {/* Features */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Users,    title: "Find partners", desc: "Browse players at your UTR near your zip code" },
                { icon: Calendar, title: "Book sessions", desc: "Request, schedule, and get reminders automatically" },
                { icon: Shield,   title: "Parent-approved", desc: "Parent consent required for under-18 players" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                  <Icon className="w-6 h-6 text-accent mx-auto mb-3" />
                  <p className="font-semibold text-sm mb-1">{title}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* CTA repeat */}
            <div className="text-center space-y-3 pt-2">
              <Link href={signupUrl}>
                <Button
                  size="lg"
                  className="h-14 px-10 font-bold bg-accent text-accent-foreground hover:bg-accent/90 rounded-2xl w-full sm:w-auto"
                >
                  Create your free account
                </Button>
              </Link>
              <p className="text-sm text-white/50">
                Already have an account?{" "}
                <Link href="/auth" className="text-white/80 hover:text-white underline underline-offset-2">
                  Log in
                </Link>
              </p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
