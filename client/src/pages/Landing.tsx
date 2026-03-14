import tennisCourtAerial from "@assets/stock_images/tennis_balls_court_2.jpg";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Trophy, Activity, Users, ArrowRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen w-screen bg-background flex items-center justify-center">Loading...</div>;
  if (user) return <Redirect to="/" />;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-2xl text-primary">
            <Trophy className="w-8 h-8 text-accent" />
            <span>JuniorHit</span>
          </div>
          <div className="flex gap-4">
            <Link href="/auth">
              <Button variant="ghost" className="font-semibold" data-testid="button-login">
                Log In
              </Button>
            </Link>
            <Link href="/auth">
              <Button className="bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20" data-testid="button-signup">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-accent/10 text-accent-foreground text-sm font-bold tracking-wide uppercase border border-accent/20 mb-4">
              For Tennis Players
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-primary leading-tight">
              Find your next <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
                Hitting Partner
              </span>
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-xl text-muted-foreground leading-relaxed"
          >
            Connect with other players near you. Schedule practice matches, improve your UTR, and level up your game.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/auth">
              <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/25 rounded-2xl" data-testid="button-get-started">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Users,
              title: "Find Players",
              desc: "Browse player profiles by UTR, location, and play style to find the perfect match."
            },
            {
              icon: Activity,
              title: "Track Progress",
              desc: "Keep your profile updated with your latest UTR and match results."
            },
            {
              icon: Calendar,
              title: "Schedule Hits",
              desc: "Easily request and schedule hitting sessions with built-in coordination tools."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + (i * 0.1) }}
              className="bg-white p-8 rounded-3xl border border-border/50 shadow-sm hover:shadow-xl hover:border-accent/50 transition-all duration-300 group"
            >
              <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                <feature.icon className="w-6 h-6 text-primary group-hover:text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
        
        {/* Decorative image */}
        <div className="mt-24 rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-muted">
          <img 
            src={tennisCourtAerial} 
            alt="Tennis court aerial" 
            className="w-full h-64 md:h-96 object-cover hover:scale-105 transition-transform duration-700"
          />
        </div>
      </div>
    </div>
  );
}
