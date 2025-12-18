import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profiles";
import { useHitRequests } from "@/hooks/use-hit-requests";
import { Navigation } from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, MapPin, Calendar, Clock, ArrowUpRight } from "lucide-react";
import { Link, Redirect } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  
  // Safe to assume user exists due to layout wrapper, but check anyway
  if (!user) return <Redirect to="/" />;

  const { data: profile, isLoading: profileLoading } = useProfile(user.id);
  const { data: requests, isLoading: requestsLoading } = useHitRequests();

  if (profileLoading || requestsLoading) {
    return (
      <div className="min-h-screen bg-muted/30 pl-0 md:pl-64">
        <div className="p-8 flex justify-center">Loading...</div>
      </div>
    );
  }

  // If no profile, redirect to setup
  if (!profile) return <Redirect to="/profile-setup" />;

  const upcomingHits = requests?.filter(r => r.status === 'accepted').slice(0, 3) || [];
  const pendingRequests = requests?.filter(r => r.status === 'pending' && r.receiverId === user.id).length || 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <main className="md:pl-64 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
          
          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-primary">
                Welcome back, {user.firstName}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Ready to find your next hitting partner?
              </p>
            </div>
            <Link href="/players">
              <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                Find Players
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Profile Summary Card */}
            <Card className="md:col-span-2 border-0 shadow-lg shadow-black/5 rounded-3xl overflow-hidden bg-white">
              <div className="h-32 bg-gradient-to-r from-primary to-blue-900 relative">
                <div className="absolute -bottom-10 left-8">
                  <Avatar className="w-24 h-24 border-4 border-white shadow-md">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-muted text-2xl font-bold text-primary">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <CardContent className="pt-14 pb-8 px-8">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold font-display">{user.firstName} {user.lastName}</h2>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                      <MapPin className="w-4 h-4" />
                      {profile.location || "Location not set"}
                    </div>
                  </div>
                  <div className="bg-accent/10 text-accent-foreground px-4 py-2 rounded-xl border border-accent/20 flex flex-col items-center">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">UTR</span>
                    <span className="text-2xl font-display font-bold text-primary">{profile.utrRating || "-"}</span>
                  </div>
                </div>
                <p className="text-muted-foreground line-clamp-2 mb-6">
                  {profile.bio || "No bio yet. Add one to let others know your play style!"}
                </p>
                <div className="flex gap-3">
                  <Link href="/profile">
                    <Button variant="outline" size="sm" className="rounded-xl">Edit Profile</Button>
                  </Link>
                  {pendingRequests > 0 && (
                    <Link href="/requests">
                      <Button size="sm" className="bg-accent text-primary hover:bg-accent/90 rounded-xl font-bold">
                        {pendingRequests} Pending Requests
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Hits Card */}
            <Card className="border-0 shadow-lg shadow-black/5 rounded-3xl bg-white flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Calendar className="w-5 h-5 text-accent" />
                  Upcoming Hits
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {upcomingHits.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Calendar className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-sm">No scheduled hits yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingHits.map((hit) => {
                      const isMeRequester = hit.requesterId === user.id;
                      const partner = isMeRequester ? hit.receiver : hit.requester;
                      
                      return (
                        <div key={hit.id} className="p-3 rounded-xl bg-muted/50 border hover:border-primary/20 transition-colors">
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={partner?.user?.profileImageUrl || undefined} />
                              <AvatarFallback>{partner?.user?.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-sm">{partner?.user?.firstName} {partner?.user?.lastName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {hit.scheduledTime ? format(new Date(hit.scheduledTime), "MMM d, h:mm a") : "TBD"}
                          </div>
                        </div>
                      );
                    })}
                    <Link href="/requests" className="block text-center mt-4">
                      <Button variant="link" size="sm" className="text-primary">
                        View all <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
