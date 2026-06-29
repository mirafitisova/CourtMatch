import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Send, Trash2, Loader2, Megaphone } from "lucide-react";

interface Broadcast {
  id: number;
  title: string;
  body: string;
  areaFilter: string | null;
  scheduledAt: string;
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
}

export default function NotificationsAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", areaFilter: "", scheduledAt: "" });

  if (!user) return <Redirect to="/" />;
  if (!user.isAdmin) return <Redirect to="/" />;

  const { data: broadcasts = [], isLoading } = useQuery<Broadcast[]>({
    queryKey: ["/api/admin/broadcasts"],
    queryFn: () => apiRequest("GET", "/api/admin/broadcasts").then(r => r.json()),
  });

  const create = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/admin/broadcasts", {
        ...data,
        areaFilter: data.areaFilter.trim() || null,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      setCreateOpen(false);
      setForm({ title: "", body: "", areaFilter: "", scheduledAt: "" });
      toast({ title: "Broadcast scheduled" });
    },
    onError: () => toast({ title: "Failed to create broadcast", variant: "destructive" }),
  });

  const sendNow = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/admin/broadcasts/${id}/send`, {}).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: `Sent to ${data.sent} recipients` });
    },
    onError: (e: any) => toast({ title: e.message ?? "Send failed", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/broadcasts/${id}`, undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: "Deleted" });
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="md:pl-64 pb-20">
        <div className="bg-white border-b px-4 py-4 sticky top-16 md:top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Broadcast Notifications</h1>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="rounded-xl gap-2">
              <Plus className="w-4 h-4" /> New Broadcast
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {isLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

          {!isLoading && broadcasts.length === 0 && (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No broadcasts yet. Create one to reach all active players.</p>
            </div>
          )}

          {broadcasts.map(b => (
            <Card key={b.id} className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{b.title}</h3>
                      {b.sentAt ? (
                        <Badge className="bg-green-100 text-green-700 border-0">
                          ✓ Sent · {b.recipientCount} recipients
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-0">Scheduled</Badge>
                      )}
                      {b.areaFilter && (
                        <Badge variant="outline" className="text-xs">{b.areaFilter}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-2">{b.body}</p>
                    <p className="text-xs text-slate-400">
                      Scheduled: {format(new Date(b.scheduledAt), "MMM d, yyyy h:mm a")}
                      {b.sentAt && ` · Sent: ${format(new Date(b.sentAt), "MMM d, h:mm a")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!b.sentAt && (
                      <Button
                        size="sm"
                        className="rounded-xl gap-1.5"
                        onClick={() => sendNow.mutate(b.id)}
                        disabled={sendNow.isPending}
                      >
                        <Send className="w-3.5 h-3.5" /> Send now
                      </Button>
                    )}
                    {!b.sentAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl text-slate-400 hover:text-destructive"
                        onClick={() => del.mutate(b.id)}
                        disabled={del.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New Broadcast</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => { e.preventDefault(); create.mutate(form); }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label>Subject / Title</Label>
              <Input
                placeholder="SoCal Closed is in 3 weeks. Find a prep partner!"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message body</Label>
              <Textarea
                placeholder="The SoCal Closed is coming up. Find a prep partner on JuniorHit to get match-ready!"
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                required
                rows={4}
                className="rounded-xl resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Area filter <span className="text-muted-foreground font-normal">(optional — leave blank to send to all)</span></Label>
              <Input
                placeholder="e.g. SoCal, Los Angeles, Santa Monica"
                value={form.areaFilter}
                onChange={e => setForm(f => ({ ...f, areaFilter: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Send at</Label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                required
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
