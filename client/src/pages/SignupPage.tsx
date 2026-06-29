import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { format, differenceInYears } from "date-fns";
import { Trophy, CalendarIcon, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export const SIGNUP_STORAGE_KEY = "courtmatch_pending_signup";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const referralCode = new URLSearchParams(search).get("ref") ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Restore form if user navigates back from guidelines page
  useEffect(() => {
    const stored = sessionStorage.getItem(SIGNUP_STORAGE_KEY);
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (data.firstName) setFirstName(data.firstName);
      if (data.lastName) setLastName(data.lastName);
      if (data.email) setEmail(data.email);
      if (data.password) { setPassword(data.password); setConfirmPassword(data.password); }
      if (data.dateOfBirth) setDob(new Date(data.dateOfBirth + "T12:00:00"));
      if (data.zipCode) setZipCode(data.zipCode);
      if (data.parentEmail) setParentEmail(data.parentEmail);
    } catch {}
  }, []);

  const age = dob ? differenceInYears(new Date(), dob) : null;
  const isUnderThirteen = age !== null && age < 13;
  const needsParentEmail = age !== null && age >= 13 && age < 18;

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "A valid email address is required";
    if (password.length < 6)
      errs.password = "Password must be at least 6 characters";
    if (password !== confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    if (!dob) {
      errs.dateOfBirth = "Date of birth is required";
    } else if (isUnderThirteen) {
      errs.dateOfBirth = "CourtMatch is for players 13 and older";
    }
    if (!/^\d{5}$/.test(zipCode)) errs.zipCode = "Zip code must be 5 digits";
    if (needsParentEmail) {
      if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
        errs.parentEmail = "A valid parent/guardian email is required";
      else if (parentEmail.trim().toLowerCase() === email.trim().toLowerCase())
        errs.parentEmail = "Parent email must be different from your email address";
    }
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    sessionStorage.setItem(
      SIGNUP_STORAGE_KEY,
      JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        dateOfBirth: format(dob!, "yyyy-MM-dd"),
        zipCode,
        ...(needsParentEmail ? { parentEmail } : {}),
        ...(referralCode ? { referralCode } : {}),
      })
    );
    navigate("/safety-guidelines");
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

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              {referralCode
                ? "You were invited! Create your account to get started."
                : "Join JuniorHit to find hitting partners near you"}
            </CardDescription>
            {referralCode && (
              <div className="mt-3 rounded-xl bg-primary/8 border border-primary/20 px-4 py-2.5 text-sm text-primary font-medium">
                🎾 Joining via an invite link
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className={cn(errors.firstName && "border-destructive")}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className={cn(errors.lastName && "border-destructive")}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={cn(errors.email && "border-destructive")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={cn(errors.password && "border-destructive")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={cn(errors.confirmPassword && "border-destructive")}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dob && "text-muted-foreground",
                        errors.dateOfBirth && "border-destructive"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      {dob ? format(dob, "MMMM d, yyyy") : "Select your date of birth"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dob}
                      onSelect={(date) => {
                        setDob(date);
                        setCalendarOpen(false);
                        setErrors((prev) => ({ ...prev, dateOfBirth: "" }));
                      }}
                      captionLayout="dropdown"
                      fromYear={1930}
                      toYear={new Date().getFullYear()}
                      defaultMonth={dob ?? new Date(2007, 0)}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
                {isUnderThirteen && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>CourtMatch is for players 13 and older.</span>
                  </div>
                )}
                {errors.dateOfBirth && !isUnderThirteen && (
                  <p className="text-xs text-destructive">{errors.dateOfBirth}</p>
                )}
              </div>

              {/* Zip Code */}
              <div className="space-y-1.5">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="12345"
                  inputMode="numeric"
                  className={cn("max-w-[160px]", errors.zipCode && "border-destructive")}
                />
                {errors.zipCode && (
                  <p className="text-xs text-destructive">{errors.zipCode}</p>
                )}
              </div>

              {/* Parent/Guardian Email — shown for ages 13–17 */}
              {needsParentEmail && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-medium">Parental approval required</p>
                    <p className="mt-0.5 text-amber-700">
                      A parent or guardian must approve your account. We'll email them a link.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="parentEmail">Parent/Guardian Email</Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="parent@email.com"
                      className={cn(errors.parentEmail && "border-destructive")}
                    />
                    {errors.parentEmail && (
                      <p className="text-xs text-destructive">{errors.parentEmail}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Form-level error */}
              {errors._form && (
                <p className="text-sm text-destructive text-center">{errors._form}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isUnderThirteen}
              >
                Continue
              </Button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/auth" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
