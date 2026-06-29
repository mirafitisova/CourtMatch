import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profiles";
import { useHitRequests } from "@/hooks/use-hit-requests";
import { useUpcomingSessions } from "@/hooks/use-sessions";
import { useMyStats } from "@/hooks/use-stats";
import { useCreditNotifications, useMarkCreditsNotified } from "@/hooks/use-invite";
import { Navigation } from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Trophy, MapPin, Calendar, Clock, ArrowRight, UserCircle, Flame, History, Copy, MessageSquare, Coins, CheckCheck } from "lucide-react";
import { Link, Redirect } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  
  // Safe to assume user exists due to layout wrapper, but check anyway
  if (!user) return <Redirect to="/" />;

  const { data: profile, isLoading: profileLoading } = useProfile(user.id);
  const { data: requests, isLoading: requestsLoading } = useHitRequests();
  const { data: upcomingSessions = [] } = useUpcomingSessions();
  const { data: stats } = useMyStats();
  const { data: creditNotifs = [] } = useCreditNotifications();
  const markNotified = useMarkCreditsNotified();
  const { toast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteLink = user.inviteCode
    ? `${window.location.origin}/invite/${user.inviteCode}`
    : null;

  // Show toast for unread credit notifications
  useEffect(() => {
    if (creditNotifs.length === 0) return;
    creditNotifs.forEach(n => {
      toast({
        title: `You earned ${n.amount} credits! 🎾`,
        description: `${n.referredUserFirstName ?? "Your friend"} completed their first session.`,
      });
    });
    markNotified.mutate(creditNotifs.map(n => n.id));
  }, [creditNotifs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function copyInviteLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareViaSms() {
    if (!inviteLink) return;
    const msg = encodeURIComponent(`I'm using JuniorHit to find hitting partners for tennis. Join me! ${inviteLink}`);
    window.open(`sms:?body=${msg}`, "_blank");
  }

  if (profileLoading || requestsLoading) {
    return (
      <div className="min-h-screen bg-muted/30 pl-0 md:pl-64">
        <div className="p-8 flex justify-center">Loading...</div>
      </div>
    );
  }

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
                Welcome{profile ? " back" : ""}, {user.firstName}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Ready to find your next hitting partner?
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Credits badge */}
              {user.practiceCredits > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 border border-accent/25 rounded-full text-sm font-semibold text-primary">
                  <Coins className="w-4 h-4 text-accent" />
                  {user.practiceCredits} credits
                </div>
              )}
              <Button
                variant="outline"
                className="gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                onClick={() => setInviteOpen(true)}
              >
                🎾 Invite a Friend
              </Button>
              <Link href="/players">
                <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  Find Players
                </Button>
              </Link>
            </div>
          </div>

          {/* Soft profile completion prompt */}
          {!profile && (
            <div className="flex items-center justify-between gap-4 bg-accent/10 border border-accent/20 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <UserCircle className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-primary">Finish setting up your profile</p>
                  <p className="text-sm text-muted-foreground">Add your UTR and location so other players can find you.</p>
                </div>
              </div>
              <Link href="/onboarding">
                <Button size="sm" className="shrink-0">Complete Profile</Button>
              </Link>
            </div>
          )}

          {/* Quick stats */}
          {stats && (stats.totalSessions > 0 || stats.streak > 0) && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3">
                <Flame className="w-7 h-7 text-orange-500 shrink-0" />
                <div>
                  <p className="text-2xl font-display font-bold text-primary leading-none">{stats.streak}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">week streak</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3">
                <Calendar className="w-7 h-7 text-primary shrink-0" />
                <div>
                  <p className="text-2xl font-display font-bold text-primary leading-none">{stats.sessionsThisMonth}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">this month</p>
                </div>
              </div>
              <Link href="/sessions">
                <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <History className="w-7 h-7 text-accent shrink-0" />
                  <div>
                    <p className="text-2xl font-display font-bold text-primary leading-none">{stats.totalSessions}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">total</p>
                  </div>
                </div>
              </Link>
            </div>
          )}

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
                      {profile?.location || "Location not set"}
                    </div>
                  </div>
                  <div className="bg-accent/10 text-accent-foreground px-4 py-2 rounded-xl border border-accent/20 flex flex-col items-center">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">UTR</span>
                    <span className="text-2xl font-display font-bold text-primary">{profile?.utrRating || "-"}</span>
                  </div>
                </div>
                <p className="text-muted-foreground line-clamp-2 mb-6">
                  {profile?.bio || "No bio yet. Add one to let others know your play style!"}
                </p>
                <div className="flex gap-3">
                  <Link href={profile ? "/profile" : "/onboarding"}>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      {profile ? "Edit Profile" : "Set Up Profile"}
                    </Button>
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

            {/* Upcoming Sessions Card */}
            <Card className="border-0 shadow-lg shadow-black/5 rounded-3xl bg-white flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Calendar className="w-5 h-5 text-accent" />
                  Upcoming Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {upcomingSessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Calendar className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-sm">No upcoming sessions.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingSessions.map((session: any) => (
                      <Link key={session.id} href={`/session/${session.id}`}>
                        <div className="p-3 rounded-xl bg-muted/50 border hover:border-primary/20 hover:bg-primary/5 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <Avatar className="w-7 h-7 shrink-0">
                              <AvatarFallback className="text-xs">{session.partner?.user?.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-sm">
                              {session.partner?.user?.firstName} {session.partner?.user?.lastName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(session.scheduledTime), "MMM d, h:mm a")}
                            </span>
                            {(session.court?.name || session.location) && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {session.court?.name ?? session.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                    <Link href="/requests" className="block text-center mt-2">
                      <Button variant="ghost" size="sm" className="text-primary">
                        All requests <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* ── Invite modal ─────────────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              🎾 Invite a Friend
            </DialogTitle>
            <DialogDescription>
              Share your invite link. You'll earn <strong>50 practice credits</strong> when a friend completes their first session.
            </DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-4 mt-2">
              {/* Invite link display */}
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2.5">
                <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{inviteLink}</span>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="rounded-xl gap-2"
                  onClick={copyInviteLink}
                >
                  {copied ? (
                    <><CheckCheck className="w-4 h-4 text-green-600" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copy link</>
                  )}
                </Button>
                <Button
                  className="rounded-xl gap-2"
                  onClick={shareViaSms}
                >
                  <MessageSquare className="w-4 h-4" />
                  Share via text
                </Button>
              </div>

              {/* Credits earned */}
              {user.practiceCredits > 0 && (
                <div className="flex items-center gap-2 bg-accent/10 rounded-xl px-4 py-3">
                  <Coins className="w-5 h-5 text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {user.practiceCredits} credits earned
                    </p>
                    <p className="text-xs text-muted-foreground">From successful referrals</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Your invite link is being generated — try again in a moment.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
