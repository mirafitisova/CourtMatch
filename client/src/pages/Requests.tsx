import { Navigation } from "@/components/Navigation";
import { useHitRequests, useUpdateHitRequestStatus } from "@/hooks/use-hit-requests";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, Check, X, MessageSquare, CalendarPlus, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Link, Redirect } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const PRACTICE_TYPES = ["Rally", "Match play", "Serve & return", "Drills", "Cardio tennis", "Other"];
const COST_OPTIONS = ["Split 50/50", "I'll cover", "You cover", "Free court"];

export default function Requests() {
  const { user } = useAuth();
  const { data: requests, isLoading } = useHitRequests();
  const updateStatus = useUpdateHitRequestStatus();

  const { data: courts = [] } = useQuery<any[]>({
    queryKey: ["/api/courts"],
    queryFn: async () => {
      const res = await fetch("/api/courts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Schedule dialog state
  const [scheduleDialog, setScheduleDialog] = useState<{ open: boolean; requestId: number | null; partnerName: string }>({
    open: false, requestId: null, partnerName: ""
  });
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleLocation, setScheduleLocation] = useState("");
  const [scheduleCourt, setScheduleCourt] = useState<number | undefined>(undefined);
  const [practicetype, setPracticetype] = useState("");
  const [costSplit, setCostSplit] = useState("");

  if (!user) return <Redirect to="/" />;

  const received = requests?.filter(r => r.receiverId === user.id) || [];
  const sent = requests?.filter(r => r.requesterId === user.id) || [];

  const resetDialog = () => {
    setScheduleTime("");
    setScheduleLocation("");
    setScheduleCourt(undefined);
    setPracticetype("");
    setCostSplit("");
  };

  const openAcceptDialog = (requestId: number, partnerName: string) => {
    resetDialog();
    setScheduleDialog({ open: true, requestId, partnerName });
  };

  const handleAccept = (skipSchedule = false) => {
    if (!scheduleDialog.requestId) return;
    updateStatus.mutate({
      id: scheduleDialog.requestId,
      status: "accepted",
      scheduledTime: (!skipSchedule && scheduleTime) ? scheduleTime : undefined,
      location: (!skipSchedule && scheduleLocation) ? scheduleLocation : undefined,
      courtId: (!skipSchedule && scheduleCourt) ? scheduleCourt : undefined,
      practiceType: (!skipSchedule && practicetype) ? practicetype : undefined,
      costSplit: (!skipSchedule && costSplit) ? costSplit : undefined,
    }, {
      onSuccess: () => setScheduleDialog({ open: false, requestId: null, partnerName: "" }),
    });
  };

  const handleAddSchedule = (requestId: number) => {
    const req = requests?.find(r => r.id === requestId);
    const partner = req?.requester;
    resetDialog();
    setScheduleDialog({
      open: true,
      requestId,
      partnerName: `${partner?.user?.firstName} ${partner?.user?.lastName}`,
    });
  };

  const handleSaveSchedule = () => {
    if (!scheduleDialog.requestId) return;
    updateStatus.mutate({
      id: scheduleDialog.requestId,
      status: "accepted",
      scheduledTime: scheduleTime || undefined,
      location: scheduleLocation || undefined,
      courtId: scheduleCourt,
      practiceType: practicetype || undefined,
      costSplit: costSplit || undefined,
    }, {
      onSuccess: () => setScheduleDialog({ open: false, requestId: null, partnerName: "" }),
    });
  };

  const RequestCard = ({ req, type }: { req: any; type: "received" | "sent" }) => {
    const isReceived = type === "received";
    const partner = isReceived ? req.requester : req.receiver;
    const partnerName = `${partner?.user?.firstName || ""} ${partner?.user?.lastName || ""}`.trim();
    const hasSchedule = req.scheduledTime || req.location;

    return (
      <Card className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4">
            {/* Top row: avatar + name + status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 shrink-0">
                  <AvatarImage src={partner?.user?.profileImageUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {partner?.user?.firstName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-base font-display leading-tight">{partnerName}</p>
                  {partner?.utrRating && (
                    <p className="text-xs text-muted-foreground">UTR {partner.utrRating}</p>
                  )}
                </div>
              </div>
              <Badge className={`shrink-0 capitalize border-0 font-semibold px-3 py-1 text-xs
                ${req.status === "pending" ? "bg-yellow-100 text-yellow-700" : ""}
                ${req.status === "accepted" ? "bg-green-100 text-green-700" : ""}
                ${req.status === "rejected" ? "bg-red-100 text-red-700" : ""}
                ${req.status === "completed" ? "bg-blue-100 text-blue-700" : ""}
              `}>
                {req.status === "accepted" ? "✓ Accepted" : req.status}
              </Badge>
            </div>

            {/* Message */}
            {req.message && (
              <div className="flex gap-2.5 bg-muted/50 rounded-xl p-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground italic">"{req.message}"</p>
              </div>
            )}

            {/* Schedule details for accepted requests */}
            {req.status === "accepted" && (
              <div className="bg-green-50 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 items-center justify-between">
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    <div className="flex items-center gap-1.5 text-sm text-green-800">
                      <Calendar className="w-4 h-4" />
                      {req.scheduledTime
                        ? format(new Date(req.scheduledTime), "EEE, MMM d")
                        : <span className="italic text-green-600">Date TBD</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-green-800">
                      <Clock className="w-4 h-4" />
                      {req.scheduledTime
                        ? format(new Date(req.scheduledTime), "h:mm a")
                        : <span className="italic text-green-600">Time TBD</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-green-800">
                      <MapPin className="w-4 h-4" />
                      {req.location
                        ? req.location
                        : <span className="italic text-green-600">Location TBD</span>}
                    </div>
                  </div>
                  {!hasSchedule && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-700 border-green-200 hover:bg-green-100 rounded-lg text-xs h-8"
                      onClick={() => handleAddSchedule(req.id)}
                      data-testid={`button-add-schedule-${req.id}`}
                    >
                      <CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> Add Schedule
                    </Button>
                  )}
                </div>
                <Link href={`/session/${req.id}`}>
                  <Button size="sm" className="w-full rounded-lg text-xs h-8 bg-green-700 hover:bg-green-800">
                    View Session Details <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Actions for received pending requests */}
            {isReceived && req.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 rounded-xl"
                  onClick={() => openAcceptDialog(req.id, partnerName)}
                  disabled={updateStatus.isPending}
                  data-testid={`button-accept-${req.id}`}
                >
                  <Check className="w-4 h-4 mr-1.5" /> Accept
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  onClick={() => updateStatus.mutate({ id: req.id, status: "rejected" })}
                  disabled={updateStatus.isPending}
                  data-testid={`button-decline-${req.id}`}
                >
                  <X className="w-4 h-4 mr-1.5" /> Decline
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <main className="md:pl-64 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          <h1 className="text-3xl font-display font-bold text-primary mb-8">Hit Requests</h1>

          <Tabs defaultValue="received" className="w-full">
            <TabsList className="mb-6 bg-white p-1 rounded-2xl border shadow-sm w-full">
              <TabsTrigger value="received" className="flex-1 rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                Received {received.filter(r => r.status === "pending").length > 0 && (
                  <span className="ml-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {received.filter(r => r.status === "pending").length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex-1 rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                Sent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : received.length > 0 ? (
                received.map(req => <RequestCard key={req.id} req={req} type="received" />)
              ) : (
                <div className="text-center py-16 text-muted-foreground bg-white rounded-3xl border border-dashed">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No requests yet</p>
                  <p className="text-sm mt-1">When players request to hit with you, they'll appear here.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent" className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : sent.length > 0 ? (
                sent.map(req => <RequestCard key={req.id} req={req} type="sent" />)
              ) : (
                <div className="text-center py-16 text-muted-foreground bg-white rounded-3xl border border-dashed">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No sent requests</p>
                  <p className="text-sm mt-1">Find players and send your first request!</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Accept & Schedule Dialog */}
      <Dialog open={scheduleDialog.open} onOpenChange={(open) => setScheduleDialog(s => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Hit with {scheduleDialog.partnerName}!
            </DialogTitle>
            <DialogDescription>
              Set a time and place — or skip and sort it out later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Calendar className="w-4 h-4" /> Date & Time
              </label>
              <Input
                type="datetime-local"
                className="rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                data-testid="input-schedule-time"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-2 text-primary">
                <MapPin className="w-4 h-4" /> Court
              </label>
              <Select onValueChange={v => setScheduleCourt(Number(v))}>
                <SelectTrigger className="rounded-xl bg-muted/40 border-0 focus:ring-1 focus:ring-primary/30">
                  <SelectValue placeholder="Select a court (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.distanceMiles != null ? ` · ${c.distanceMiles} mi` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!scheduleCourt && (
                <Input
                  placeholder="Or type a location..."
                  className="rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                  value={scheduleLocation}
                  onChange={e => setScheduleLocation(e.target.value)}
                  data-testid="input-schedule-location"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-primary">Practice type</label>
                <Select onValueChange={setPracticetype}>
                  <SelectTrigger className="rounded-xl bg-muted/40 border-0 focus:ring-1 focus:ring-primary/30">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRACTICE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-primary">Cost split</label>
                <Select onValueChange={setCostSplit}>
                  <SelectTrigger className="rounded-xl bg-muted/40 border-0 focus:ring-1 focus:ring-primary/30">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_OPTIONS.map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => handleAccept(true)}
                disabled={updateStatus.isPending}
                data-testid="button-accept-skip-schedule"
              >
                Skip for now
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={() => handleAccept(false)}
                disabled={updateStatus.isPending}
                data-testid="button-accept-with-schedule"
              >
                {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept & Schedule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
