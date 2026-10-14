import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Trophy, ArrowRight, UserCircle, Search, Calendar,
  Shield, Star, CheckCircle, ChevronDown, Users, Mail,
  Zap, Lock, Eye,
} from "lucide-react";

const courtHero = "https://images.unsplash.com/photo-1478327130949-c96cb25ee9c4?w=1920&q=85&fit=crop&auto=format";
const aerialCourt = "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1200&q=85&fit=crop&auto=format";

// ── Scroll-aware navbar ───────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <div className={`flex items-center gap-2 font-display font-bold text-xl transition-colors ${scrolled ? "text-primary" : "text-white"}`}>
          <Trophy className={`w-6 h-6 transition-colors ${scrolled ? "text-accent" : "text-accent"}`} />
          <span>CourtMatch</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/auth">
            <Button
              variant="ghost"
              size="sm"
              className={`font-semibold transition-colors ${
                scrolled ? "text-slate-700 hover:text-primary" : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              Log In
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className={`font-bold rounded-xl transition-all ${
                scrolled
                  ? "bg-primary text-white hover:bg-primary/90 shadow-md"
                  : "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg"
              }`}
            >
              Sign Up Free
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <Navbar />

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Background image + gradient overlay */}
        <div className="absolute inset-0">
          <img
            src={courtHero}
            alt="Tennis court"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f2d1c]/85 via-[#1a4a2e]/80 to-[#0f2d1c]/90" />
        </div>

        {/* Content */}
        <div className="relative z-10 px-5 max-w-4xl mx-auto pt-20 pb-16">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.12 } } }}
            className="space-y-6"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/20 text-accent text-sm font-bold border border-accent/30 mb-2">
                <Zap className="w-3.5 h-3.5" />
                Open to all players · Great for juniors
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-white leading-[1.05] tracking-tight"
            >
              Find your perfect<br />
              <span className="text-accent">hitting partner</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl text-white/75 max-w-2xl mx-auto leading-relaxed"
            >
              CourtMatch connects tennis players with practice partners at their skill level.
              Verified UTR ratings. Parent-approved safety for juniors. Courts near you.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="h-14 px-10 text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90 rounded-2xl shadow-2xl shadow-accent/30"
                  data-testid="button-get-started"
                >
                  Get Started — it&apos;s free <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/auth">
                <button className="text-white/70 hover:text-white text-sm underline underline-offset-4 transition-colors">
                  Already have an account? Log in
                </button>
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      {/* ── 2. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-24 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-sm font-bold uppercase tracking-widest text-primary/60 mb-3 block">How It Works</span>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900">
              From signup to the court<br className="hidden sm:block" /> in minutes
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                step: "01",
                icon: UserCircle,
                title: "Create your profile",
                desc: "Add your UTR rating, school, grade, and weekly availability. Verify your UTR for more matches.",
                color: "bg-emerald-50 text-emerald-700",
              },
              {
                step: "02",
                icon: Search,
                title: "Find your match",
                desc: "Browse players nearby filtered by skill level, distance, and when they're free. See compatibility scores.",
                color: "bg-blue-50 text-blue-700",
              },
              {
                step: "03",
                icon: Calendar,
                title: "Hit the courts",
                desc: "Send a request, agree on a court and time, get session reminders, then rate your partner afterward.",
                color: "bg-amber-50 text-amber-700",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative bg-white rounded-3xl border border-slate-100 p-8 shadow-sm hover:shadow-lg transition-shadow group"
              >
                <div className="flex items-start gap-5">
                  <div className="shrink-0">
                    <span className="text-xs font-black text-slate-300 tracking-widest">{item.step}</span>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mt-2 ${item.color}`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                {/* Connector arrow (desktop) */}
                {i < 2 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-8 h-8 text-slate-200" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. SAFETY ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: image */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl overflow-hidden shadow-xl order-2 md:order-1"
            >
              <img
                src={aerialCourt}
                alt="Junior tennis player practicing on a public court"
                className="w-full h-72 md:h-96 object-cover"
              />
            </motion.div>

            {/* Right: content */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 md:order-2"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest text-primary/60">Safety First</span>
              </div>
              <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">
                Built for juniors,<br />trusted by parents
              </h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Every feature is designed with junior players and their parents in mind — not just to connect, but to connect safely.
              </p>

              <div className="space-y-4">
                {[
                  { icon: CheckCircle, text: "Parent approval required for players under 18" },
                  { icon: Eye, text: "All sessions visible to parent accounts" },
                  { icon: Lock, text: "Public courts only — no private locations" },
                  { icon: Star, text: "Post-session ratings build accountability" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <item.icon className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-slate-700 text-sm font-medium">{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 5. FOR COACHES ──────────────────────────────────────────────────── */}
      <section className="py-16 px-5 bg-white border-t border-slate-100">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/15 rounded-3xl p-8 md:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center shrink-0">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Are you a high school tennis coach?</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Help your players find practice partners outside of team practice.
                CourtMatch is free for players and designed to complement your coaching program.
              </p>
            </div>
            <a href="mailto:hello@courtmatch.org" className="shrink-0">
              <Button variant="outline" className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 gap-2">
                <Mail className="w-4 h-4" />
                Contact us
              </Button>
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── 6. FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 font-display font-bold text-xl text-white mb-3">
                <Trophy className="w-6 h-6 text-accent" />
                <span>CourtMatch</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                The hitting partner platform for tennis players everywhere — especially juniors.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Product</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
                <li><Link href="/auth" className="hover:text-white transition-colors">Log In</Link></li>
                <li><Link href="/courts" className="hover:text-white transition-colors">Courts Directory</Link></li>
              </ul>
            </div>

            {/* Safety */}
            <div>
              <p className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Safety</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/safety-guidelines" className="hover:text-white transition-colors">Safety Guidelines</Link></li>
                <li><a href="mailto:hello@courtmatch.org" className="hover:text-white transition-colors">Report an Issue</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Contact</p>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:hello@courtmatch.org" className="hover:text-white transition-colors">hello@courtmatch.org</a></li>
                <li><a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <p>© {new Date().getFullYear()} CourtMatch. All rights reserved.</p>
            <p className="text-slate-500 italic">Made by a junior tennis player 🎾</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
