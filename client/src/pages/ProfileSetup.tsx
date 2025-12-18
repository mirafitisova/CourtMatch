import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profiles";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProfileSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { Trophy, MapPin, User, Activity } from "lucide-react";
import { z } from "zod";
import { Redirect, useLocation } from "wouter";
import { useEffect } from "react";

// Schema for the form
const formSchema = insertProfileSchema.pick({
  utrRating: true,
  bio: true,
  location: true,
  playStyle: true,
  availability: true,
});

type FormValues = z.infer<typeof formSchema>;

export default function ProfileSetup() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = useProfile(user?.id || "");
  const updateProfile = useUpdateProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      utrRating: undefined,
      bio: "",
      location: "",
      playStyle: "",
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
        playStyle: profile.playStyle || "",
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
                  <label className="text-sm font-bold flex items-center gap-2 text-primary">
                    <Activity className="w-4 h-4 text-accent" /> Play Style
                  </label>
                  <Input 
                    placeholder="e.g. Aggressive Basestliner, Serve & Volley" 
                    {...form.register("playStyle")}
                    className="h-12 rounded-xl bg-muted/30 border-muted focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-primary">Bio</label>
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
        </div>
      </main>
    </div>
  );
}
