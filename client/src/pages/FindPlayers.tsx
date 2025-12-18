import { Navigation } from "@/components/Navigation";
import { useProfiles } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateRequestModal } from "@/components/CreateRequestModal";
import { Search, MapPin, Trophy, Filter } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Redirect } from "wouter";

export default function FindPlayers() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [minUtr, setMinUtr] = useState("");
  
  const { data: profiles, isLoading } = useProfiles({ 
    search: search.length > 2 ? search : undefined,
    minUtr: minUtr || undefined
  });

  if (!user) return <Redirect to="/" />;

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <main className="md:pl-64 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          
          <div className="mb-8 space-y-4">
            <h1 className="text-3xl font-display font-bold text-primary">Find Players</h1>
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or location..." 
                  className="pl-10 h-12 rounded-xl bg-white border-muted shadow-sm focus:border-primary focus:ring-primary/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <div className="relative w-32">
                  <Input 
                    placeholder="Min UTR" 
                    type="number"
                    className="h-12 rounded-xl bg-white border-muted shadow-sm"
                    value={minUtr}
                    onChange={(e) => setMinUtr(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="h-12 w-12 rounded-xl px-0 shrink-0">
                  <Filter className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-64 bg-white rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles?.filter(p => p.userId !== user.id).map((profile, i) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className="rounded-3xl overflow-hidden border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group bg-white h-full flex flex-col">
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-6">
                        <Avatar className="w-20 h-20 border-4 border-muted group-hover:border-primary/10 transition-colors">
                          <AvatarImage src={profile.user?.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xl font-bold bg-primary/5 text-primary">
                            {profile.user?.firstName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-end">
                          <Badge variant="secondary" className="bg-primary/5 text-primary font-display font-bold text-lg px-3 py-1">
                            UTR {profile.utrRating}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h3 className="text-xl font-bold font-display text-primary">
                          {profile.user?.firstName} {profile.user?.lastName}
                        </h3>
                        {profile.location && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {profile.location}
                          </div>
                        )}
                      </div>

                      <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-1">
                        {profile.bio || "No bio yet."}
                      </p>

                      <div className="pt-4 border-t mt-auto">
                        <CreateRequestModal receiver={profile} />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
              
              {profiles?.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <p>No players found matching your search.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
