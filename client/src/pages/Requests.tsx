import { Navigation } from "@/components/Navigation";
import { useHitRequests, useUpdateHitRequestStatus } from "@/hooks/use-hit-requests";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, Check, X, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { Redirect } from "wouter";

export default function Requests() {
  const { user } = useAuth();
  const { data: requests, isLoading } = useHitRequests();
  const updateStatus = useUpdateHitRequestStatus();

  if (!user) return <Redirect to="/" />;

  // Filter requests
  const received = requests?.filter(r => r.receiverId === user.id) || [];
  const sent = requests?.filter(r => r.requesterId === user.id) || [];

  const RequestCard = ({ req, type }: { req: any, type: 'received' | 'sent' }) => {
    const isReceived = type === 'received';
    const partner = isReceived ? req.requester : req.receiver;
    const partnerName = `${partner?.user?.firstName} ${partner?.user?.lastName}`;

    return (
      <Card className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow mb-4 bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-start gap-4 flex-1">
              <Avatar className="w-12 h-12">
                <AvatarImage src={partner?.user?.profileImageUrl} />
                <AvatarFallback>{partner?.user?.firstName?.[0]}</AvatarFallback>
              </Avatar>
              
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg font-display">
                    {isReceived ? `Request from ${partnerName}` : `Request to ${partnerName}`}
                  </h3>
                  <Badge variant="outline" className={`
                    capitalize border-0 font-bold px-3 py-1
                    ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${req.status === 'accepted' ? 'bg-green-100 text-green-700' : ''}
                    ${req.status === 'rejected' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {req.status}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    {req.scheduledTime ? format(new Date(req.scheduledTime), 'MMM d, yyyy') : 'TBD'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    {req.scheduledTime ? format(new Date(req.scheduledTime), 'h:mm a') : 'TBD'}
                  </div>
                  {req.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-primary" />
                      {req.location}
                    </div>
                  )}
                </div>

                {req.message && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-xl text-sm flex gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-muted-foreground italic">"{req.message}"</p>
                  </div>
                )}
              </div>
            </div>

            {isReceived && req.status === 'pending' && (
              <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 mt-4 md:mt-0">
                <Button 
                  className="flex-1 md:w-32 bg-primary hover:bg-primary/90"
                  onClick={() => updateStatus.mutate({ id: req.id, status: 'accepted' })}
                  disabled={updateStatus.isPending}
                >
                  <Check className="w-4 h-4 mr-2" /> Accept
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 md:w-32 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                  onClick={() => updateStatus.mutate({ id: req.id, status: 'rejected' })}
                  disabled={updateStatus.isPending}
                >
                  <X className="w-4 h-4 mr-2" /> Decline
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <h1 className="text-3xl font-display font-bold text-primary mb-8">Hit Requests</h1>

          <Tabs defaultValue="received" className="w-full">
            <TabsList className="mb-6 bg-white p-1 rounded-2xl border shadow-sm w-full md:w-auto">
              <TabsTrigger value="received" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                Received ({received.filter(r => r.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="sent" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                Sent ({sent.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="space-y-4">
              {isLoading ? <div>Loading...</div> : 
                received.length > 0 ? (
                  received.map(req => <RequestCard key={req.id} req={req} type="received" />)
                ) : (
                  <div className="text-center py-12 text-muted-foreground bg-white rounded-3xl border border-dashed">
                    <p>No received requests yet.</p>
                  </div>
                )
              }
            </TabsContent>
            
            <TabsContent value="sent" className="space-y-4">
              {isLoading ? <div>Loading...</div> : 
                sent.length > 0 ? (
                  sent.map(req => <RequestCard key={req.id} req={req} type="sent" />)
                ) : (
                  <div className="text-center py-12 text-muted-foreground bg-white rounded-3xl border border-dashed">
                    <p>You haven't sent any requests yet.</p>
                  </div>
                )
              }
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
