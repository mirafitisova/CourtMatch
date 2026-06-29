import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profiles";
import { useMyStats } from "@/hooks/use-stats";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProfileSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { Trophy, MapPin, User, Star, History } from "lucide-react";
import { z } from "zod";
import { Link, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";

// Schema for the form
const formSchema = insertProfileSchema.pick({
  utrRating: true,
  bio: true,
  location: true,
  availability: true,
});

type FormValues = z.infer<typeof formSchema>;

export default function ProfileSetup() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = useProfile(user?.id || "");
  const updateProfile = useUpdateProfile();
  const { data: stats } = useMyStats();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      utrRating: undefined,
      bio: "",
      location: "",
      availability: "",
    },
  });

  // Prefill form when data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        utrRating: profile.utrRating || undefined,
        bio: profile.bio || "",
        location: profile.location || "",
        availability: profile.availability || "",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: FormValues) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        setLocation("/"); // Redirect to dashboard after save
      }
    });
  };

  if (!user) return <Redirect to="/" />;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <main className="md:pl-64 pb-20">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
          <Card className="border-0 shadow-xl shadow-black/5 rounded-3xl bg-white">
            <CardHeader className="text-center pb-8 border-b">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <User className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl font-display font-bold text-primary">
                {profile ? "Edit Your Profile" : "Create Your Profile"}
              </CardTitle>
              <CardDescription>
                Tell other players about your game so you can find the perfect hitting partner.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 px-6 md:px-10">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-2 text-primary">
                      <Trophy className="w-4 h-4 text-accent" /> UTR Rating
                    </label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="e.g. 7.5" 
                      {...form.register("utrRating", { valueAsNumber: true })}
                      className="h-12 rounded-xl bg-muted/30 border-muted focus:ring-primary/20"
                    />
                    {form.formState.errors.utrRating && (
                      <p className="text-xs text-destructive">{form.formState.errors.utrRating.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-2 text-primary">
                      <MapPin className="w-4 h-4 text-accent" /> Location
                    </label>
                    <Input 
                      placeholder="City, State" 
                      {...form.register("location")}
                      className="h-12 rounded-xl bg-muted/30 border-muted focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-primary">Bio (Optional)</label>
                  <Textarea 
                    placeholder="Tell us about your tennis background..." 
                    {...form.register("bio")}
                    className="min-h-[100px] rounded-xl bg-muted/30 border-muted focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-primary">Availability</label>
                  <Input 
                    placeholder="e.g. Weekends, Weekday evenings" 
                    {...form.register("availability")}
                    className="h-12 rounded-xl bg-muted/30 border-muted focus:ring-primary/20"
                  />
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl"
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          {/* Stats card */}
          {stats && (
            <Card className="border-0 shadow-xl shadow-black/5 rounded-3xl bg-white">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-lg font-display font-semibold text-primary flex items-center gap-2">
                  <History className="w-5 h-5 text-accent" /> Your Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {/* Session counts */}
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{stats.totalSessions}</span> total sessions
                  {" · "}
                  <span className="font-semibold">{stats.sessionsThisMonth}</span> this month
                  {stats.streak > 0 && (
                    <> · <span className="font-semibold">{stats.streak}</span>-week streak 🔥</>
                  )}
                </p>

                {/* Avg rating */}
                {stats.avgRating != null && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${stats.avgRating! >= star ? "fill-amber-400 text-amber-400" : stats.avgRating! >= star - 0.5 ? "fill-amber-200 text-amber-400" : "text-slate-200"}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-amber-600">{stats.avgRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">avg rating</span>
                  </div>
                )}

                {/* Frequent partners / courts */}
                {stats.mostFrequentPartnerFirstName && (
                  <p className="text-sm text-muted-foreground">
                    Most frequent partner: <span className="font-medium text-foreground">
                      {stats.mostFrequentPartnerFirstName} {stats.mostFrequentPartnerLastName}
                    </span>
                  </p>
                )}
                {stats.mostFrequentCourtName && (
                  <p className="text-sm text-muted-foreground">
                    Favourite court: <span className="font-medium text-foreground">{stats.mostFrequentCourtName}</span>
                  </p>
                )}
                {stats.mostFrequentPracticeType && (
                  <p className="text-sm text-muted-foreground">
                    Top practice type: <span className="font-medium text-foreground">{stats.mostFrequentPracticeType}</span>
                  </p>
                )}

                {/* Member since */}
                {stats.memberSince && (
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    Member since {format(new Date(stats.memberSince), "MMMM yyyy")}
                  </p>
                )}

                <Link href="/sessions">
                  <Button variant="outline" size="sm" className="rounded-xl w-full">
                    View Session History
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
