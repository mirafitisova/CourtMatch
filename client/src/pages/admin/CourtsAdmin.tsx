import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Trash2, Plus, MapPin, Trophy } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CourtType = "PUBLIC_FREE" | "PUBLIC_PAY" | "PRIVATE" | "SCHOOL";
type NetCondition = "GOOD" | "FAIR" | "POOR";

interface Court {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  courtType: CourtType;
  cost: string | null;
  bookingMethod: string;
  numberOfCourts: number;
  surface: string;
  hasLights: boolean;
  hours: string | null;
  netCondition: NetCondition | null;
  hasRestrooms: boolean;
  parkingInfo: string | null;
  bestTimes: string | null;
  juniorNotes: string | null;
  bookingUrl: string | null;
}

const emptyForm = (): Omit<Court, "id"> => ({
  name: "",
  address: "",
  latitude: 0,
  longitude: 0,
  courtType: "PUBLIC_FREE",
  cost: "",
  bookingMethod: "First-come, first-served",
  numberOfCourts: 1,
  surface: "Hard",
  hasLights: false,
  hours: "",
  netCondition: null,
  hasRestrooms: false,
  parkingInfo: "",
  bestTimes: "",
  juniorNotes: "",
  bookingUrl: "",
});

const COURT_TYPE_LABELS: Record<CourtType, string> = {
  PUBLIC_FREE: "Public (Free)",
  PUBLIC_PAY: "Public (Pay)",
  PRIVATE: "Private",
  SCHOOL: "School",
};

const NET_CONDITION_LABELS: Record<NetCondition, string> = {
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CourtsAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [geocoding, setGeocoding] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && user && !user.isAdmin) navigate("/");
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: courts = [], isLoading } = useQuery<Court[]>({
    queryKey: ["/api/admin/courts"],
    queryFn: () => apiRequest("GET", "/api/admin/courts").then((r) => r.json()),
    enabled: !!user?.isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Court, "id">) =>
      apiRequest("POST", "/api/admin/courts", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courts"] });
      setDialogOpen(false);
      toast({ title: "Court added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<Court, "id"> }) =>
      apiRequest("PUT", `/api/admin/courts/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courts"] });
      setDialogOpen(false);
      toast({ title: "Court updated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/courts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courts"] });
      toast({ title: "Court deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(court: Court) {
    setEditingId(court.id);
    setForm({
      name: court.name,
      address: court.address,
      latitude: court.latitude,
      longitude: court.longitude,
      courtType: court.courtType,
      cost: court.cost ?? "",
      bookingMethod: court.bookingMethod,
      numberOfCourts: court.numberOfCourts,
      surface: court.surface,
      hasLights: court.hasLights,
      hours: court.hours ?? "",
      netCondition: court.netCondition,
      hasRestrooms: court.hasRestrooms,
      parkingInfo: court.parkingInfo ?? "",
      bestTimes: court.bestTimes ?? "",
      juniorNotes: court.juniorNotes ?? "",
      bookingUrl: court.bookingUrl ?? "",
    });
    setDialogOpen(true);
  }

  function handleDelete(court: Court) {
    if (!confirm(`Delete "${court.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(court.id);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGeocode() {
    if (!form.address.trim()) {
      toast({ title: "Enter an address first", variant: "destructive" });
      return;
    }
    setGeocoding(true);
    try {
      const res = await apiRequest("GET", `/api/admin/geocode?address=${encodeURIComponent(form.address)}`);
      const data = await res.json();
      if (!data) {
        toast({ title: "Address not found", description: "Try a more specific address.", variant: "destructive" });
      } else {
        setForm((prev) => ({ ...prev, latitude: data.lat, longitude: data.lng }));
        toast({ title: "Coordinates found", description: data.displayName });
      }
    } catch {
      toast({ title: "Geocoding failed", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  }

  function handleSubmit() {
    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      numberOfCourts: Number(form.numberOfCourts),
      cost: form.cost || null,
      hours: form.hours || null,
      parkingInfo: form.parkingInfo || null,
      bestTimes: form.bestTimes || null,
      juniorNotes: form.juniorNotes || null,
      bookingUrl: form.bookingUrl || null,
      netCondition: form.netCondition || null,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (authLoading || (!user?.isAdmin && !authLoading)) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-bold text-lg leading-none">Courts Admin</h1>
            <p className="text-xs text-muted-foreground mt-0.5">CourtMatch · {courts.length} courts</p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Court
        </Button>
      </header>

      {/* Court table */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : courts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No courts yet</p>
            <p className="text-sm">Add your first court or run <code className="bg-muted px-1 rounded">npm run db:seed-courts</code></p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Courts</TableHead>
                  <TableHead>Surface</TableHead>
                  <TableHead className="text-center">Lights</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courts.map((court) => (
                  <TableRow key={court.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">{court.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{court.address}</TableCell>
                    <TableCell>
                      <Badge variant={court.courtType === "PUBLIC_FREE" ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                        {COURT_TYPE_LABELS[court.courtType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{court.numberOfCourts}</TableCell>
                    <TableCell className="text-sm">{court.surface}</TableCell>
                    <TableCell className="text-center text-sm">{court.hasLights ? "✓" : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(court)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(court)} disabled={deleteMutation.isPending}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Court" : "Add New Court"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* ── Basic info ── */}
            <Section title="Basic Info">
              <Field label="Name *">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Verdugo Park Tennis Courts" />
              </Field>
              <Field label="Address *">
                <div className="flex gap-2">
                  <Input
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="3201 W Verdugo Ave, Burbank, CA"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleGeocode} disabled={geocoding} className="shrink-0">
                    {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    <span className="ml-1 hidden sm:inline">Look up</span>
                  </Button>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Court Type *">
                  <Select value={form.courtType} onValueChange={(v) => set("courtType", v as CourtType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(COURT_TYPE_LABELS) as [CourtType, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Number of Courts *">
                  <Input type="number" min={1} value={form.numberOfCourts} onChange={(e) => set("numberOfCourts", parseInt(e.target.value) || 1)} />
                </Field>
              </div>
              <Field label="Surface *">
                <Input value={form.surface} onChange={(e) => set("surface", e.target.value)} placeholder="Hard, Clay, Grass…" />
              </Field>
            </Section>

            {/* ── Location ── */}
            <Section title="Coordinates">
              <p className="text-xs text-muted-foreground -mt-1">Use "Look up" above to auto-fill from address, or enter manually.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <Input type="number" step="any" value={form.latitude} onChange={(e) => set("latitude", parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="Longitude">
                  <Input type="number" step="any" value={form.longitude} onChange={(e) => set("longitude", parseFloat(e.target.value) || 0)} />
                </Field>
              </div>
            </Section>

            {/* ── Pricing & booking ── */}
            <Section title="Pricing & Booking">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cost">
                  <Input value={form.cost ?? ""} onChange={(e) => set("cost", e.target.value)} placeholder='Free, $8–11/hr…' />
                </Field>
                <Field label="Booking Method *">
                  <Input value={form.bookingMethod} onChange={(e) => set("bookingMethod", e.target.value)} placeholder="First-come, first-served" />
                </Field>
              </div>
              <Field label="Booking URL">
                <Input type="url" value={form.bookingUrl ?? ""} onChange={(e) => set("bookingUrl", e.target.value)} placeholder="https://…" />
              </Field>
            </Section>

            {/* ── Facilities ── */}
            <Section title="Facilities">
              <Field label="Hours">
                <Input value={form.hours ?? ""} onChange={(e) => set("hours", e.target.value)} placeholder="7am–9pm daily" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Net Condition">
                  <Select
                    value={form.netCondition ?? "none"}
                    onValueChange={(v) => set("netCondition", v === "none" ? null : v as NetCondition)}
                  >
                    <SelectTrigger><SelectValue placeholder="Unknown" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unknown</SelectItem>
                      {(Object.entries(NET_CONDITION_LABELS) as [NetCondition, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Parking Info">
                  <Input value={form.parkingInfo ?? ""} onChange={(e) => set("parkingInfo", e.target.value)} placeholder="Free street parking" />
                </Field>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.hasLights} onCheckedChange={(v) => set("hasLights", v)} />
                  <span className="text-sm font-medium">Has Lights</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.hasRestrooms} onCheckedChange={(v) => set("hasRestrooms", v)} />
                  <span className="text-sm font-medium">Has Restrooms</span>
                </label>
              </div>
            </Section>

            {/* ── Notes ── */}
            <Section title="Notes for Juniors">
              <Field label="Best Times">
                <Input value={form.bestTimes ?? ""} onChange={(e) => set("bestTimes", e.target.value)} placeholder="Weekday afternoons, early mornings…" />
              </Field>
              <Field label="Junior Notes">
                <Textarea
                  value={form.juniorNotes ?? ""}
                  onChange={(e) => set("juniorNotes", e.target.value)}
                  placeholder="Tips for junior players…"
                  rows={3}
                />
              </Field>
            </Section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              {editingId !== null ? "Save Changes" : "Add Court"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
