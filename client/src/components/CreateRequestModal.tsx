import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertHitRequestSchema, type ProfileWithUser } from "@shared/schema";
import { useCreateHitRequest } from "@/hooks/use-hit-requests";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, MapPin, MessageSquare, Clock } from "lucide-react";
import { z } from "zod";
import { useState } from "react";

// Extend the schema to handle the string -> date conversion from the form
const formSchema = insertHitRequestSchema.extend({
  scheduledTime: z.string().transform((str) => new Date(str)),
}).omit({ 
  requesterId: true, 
  receiverId: true, 
  status: true,
  createdAt: true 
});

type FormValues = z.infer<typeof formSchema>;

interface CreateRequestModalProps {
  receiver: ProfileWithUser;
  trigger?: React.ReactNode;
}

export function CreateRequestModal({ receiver, trigger }: CreateRequestModalProps) {
  const { user } = useAuth();
  const createRequest = useCreateHitRequest();
  const [open, setOpen] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: FormValues) => {
    if (!user) return;

    createRequest.mutate({
      requesterId: user.id, // Auth user is requester
      receiverId: receiver.userId,
      scheduledTime: data.scheduledTime,
      location: data.location,
      message: data.message,
      status: 'pending',
    }, {
      onSuccess: () => {
        setOpen(false);
        reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
            Request to Hit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Hit with {receiver.user?.firstName}</DialogTitle>
          <DialogDescription>
            Propose a time and location for a practice session.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Date & Time
            </label>
            <Input 
              type="datetime-local" 
              className="bg-muted/50 border-0 focus:ring-2 ring-primary/20"
              {...register("scheduledTime")} 
            />
            {errors.scheduledTime && (
              <p className="text-destructive text-xs">{errors.scheduledTime.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Location
            </label>
            <Input 
              placeholder="e.g. Central Park Tennis Center"
              className="bg-muted/50 border-0 focus:ring-2 ring-primary/20"
              {...register("location")}
            />
            {errors.location && (
              <p className="text-destructive text-xs">{errors.location.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Message
            </label>
            <Textarea 
              placeholder="Hey! Looking forward to hitting. What's your play style?"
              className="bg-muted/50 border-0 focus:ring-2 ring-primary/20 min-h-[100px]"
              {...register("message")}
            />
          </div>

          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold" 
              disabled={createRequest.isPending}
            >
              {createRequest.isPending ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
