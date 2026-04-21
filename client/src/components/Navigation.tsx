import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Users, Calendar, UserCircle, LogOut, Menu, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function Navigation() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Find Partners", icon: Users },
    { href: "/courts", label: "Courts", icon: MapPin },
    { href: "/requests", label: "Requests", icon: Calendar },
    { href: "/profile", label: "My Profile", icon: UserCircle },
  ];

  const NavLink = ({ item, mobile = false }: { item: typeof navItems[0], mobile?: boolean }) => {
    const isActive = location === item.href;
    return (
      <Link href={item.href}>
        <div 
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer
            ${isActive 
              ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          `}
          onClick={() => mobile && setIsOpen(false)}
        >
          <item.icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />
          <span>{item.label}</span>
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 font-display font-bold text-xl text-primary">
          <Trophy className="w-6 h-6 text-accent" />
          <span>CourtMatch</span>
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2 font-display font-bold text-2xl text-primary mb-6">
                <Trophy className="w-8 h-8 text-accent" />
                <span>CourtMatch</span>
              </div>
              {user && (
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="font-semibold truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} mobile />
              ))}
              <Button 
                variant="ghost" 
                className="justify-start gap-3 px-4 py-3 mt-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => logout()}
                data-testid="button-mobile-signout"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 border-r bg-background z-40">
        <div className="p-8">
          <Link href="/">
            <div className="flex items-center gap-2 font-display font-bold text-2xl text-primary cursor-pointer">
              <Trophy className="w-8 h-8 text-accent" />
              <span>CourtMatch</span>
            </div>
          </Link>
        </div>

        <div className="flex-1 px-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div className="p-4 border-t m-4">
          {user && (
            <div className="flex items-center gap-3 mb-4 px-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate" data-testid="text-username">{user.firstName} {user.lastName}</p>
              </div>
            </div>
          )}
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 border-dashed hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors"
            onClick={() => logout()}
            data-testid="button-signout"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    </>
  );
}
