import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Trophy, Shield, Loader2, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { SIGNUP_STORAGE_KEY } from "./SignupPage";

const GUIDELINES = [
  "Always meet at public tennis courts.",
  "Tell a parent or guardian where you're going and who you're meeting.",
  "Never share your home address, school address, or other private locations.",
  "If someone makes you uncomfortable, leave and report them immediately.",
  "Bring your own equipment and water.",
  "Be respectful and a good sport — this community depends on trust.",
  "Parents can view all your sessions through the parent dashboard.",
];

export default function SafetyGuidelines() {
  const [, navigate] = useLocation();
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem(SIGNUP_STORAGE_KEY);
    if (!stored) {
      navigate("/signup");
    }
  }, [navigate]);

  async function handleCreateAccount() {
    if (!agreed) return;

    const stored = sessionStorage.getItem(SIGNUP_STORAGE_KEY);
    if (!stored) {
      navigate("/signup");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = JSON.parse(stored);
      const res = await apiRequest("POST", "/api/auth/register", formData);
      const data = await res.json();
      sessionStorage.removeItem(SIGNUP_STORAGE_KEY);
      if (data.emailWarning) {
        setError(data.emailWarning);
      } else {
        navigate("/signup/success");
      }
    } catch (err: any) {
      const raw: string = err?.message || "Registration failed";
      try {
        const parsed = JSON.parse(raw.split(": ").slice(1).join(": "));
        const msg = parsed.message || raw;
        const detail = parsed.detail ? ` (${parsed.detail})` : "";
        setError(msg + detail);
      } catch {
        setError(raw);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <Trophy className="w-10 h-10 text-primary" />
          <span className="font-display font-bold text-3xl text-primary">CourtMatch</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">✓</span>
            <span>Your details</span>
          </div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
            <span>Safety guidelines</span>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle>Community Safety Guidelines</CardTitle>
            <CardDescription>
              Please read all guidelines carefully before creating your account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-4">
            {/* Scrollable rules */}
            <div className="relative">
              <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-4 space-y-3">
                {GUIDELINES.map((rule, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
              {/* Bottom fade hint */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 rounded-b-lg bg-gradient-to-t from-background/80 to-transparent" />
            </div>

            {/* Agreement checkbox */}
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 transition-colors cursor-pointer",
                agreed ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
              )}
              onClick={() => setAgreed((v) => !v)}
            >
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5"
              />
              <Label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer font-normal select-none">
                I have read and agree to the{" "}
                <span className="font-semibold text-foreground">
                  CourtMatch Community Guidelines
                </span>
              </Label>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/signup")}
                disabled={isSubmitting}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!agreed || isSubmitting}
                onClick={handleCreateAccount}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
