import { Button } from "@/components/ui/beautiful-button";
import { Mic, TrendingUp, Users } from "lucide-react";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[hsl(var(--brand-coral))]/5 rounded-full blur-3xl opacity-60" />
      </div>

      <nav className="relative z-10 container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-[hsl(var(--brand-coral))] w-10 h-10 rounded-xl flex items-center justify-center">
            <span className="text-white font-display font-bold text-lg">R</span>
          </div>
          <span className="font-display font-bold text-xl">Reserve<span className="text-[hsl(var(--brand-green))]">TMK</span></span>
        </div>
        <Button onClick={handleLogin} className="shadow-lg" data-testid="button-login">Login / Sign Up</Button>
      </nav>

      <main className="relative z-10 container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium text-secondary-foreground mb-4 border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--brand-coral))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--brand-coral))]"></span>
            </span>
            Community Innovation Hub
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground leading-[1.1]">
            Track Growth, <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--brand-coral))] via-[hsl(var(--brand-pink))] to-[hsl(var(--brand-green))]">
              Measure Impact.
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Record voice debriefs from your community sessions and let AI extract key insights on engagement, delivery, and outcomes automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" variant="premium" onClick={handleLogin} className="text-lg px-10 h-14" data-testid="button-get-started">
              Get Started
            </Button>
          </div>
        </div>

        <div className="mt-32 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Mic,
              title: "Voice-to-Insight",
              desc: "Record your debriefs. We transcribe and extract meaningful data points automatically."
            },
            {
              icon: TrendingUp,
              title: "Impact Reporting",
              desc: "Visualize engagement, delivery, and outcomes over time with funder-ready reports."
            },
            {
              icon: Users,
              title: "Community CRM",
              desc: "Organize mentees, entrepreneurs, groups, and partners in one centralized hub."
            }
          ].map((feature, i) => (
            <div key={i} className="bg-card/50 backdrop-blur-sm border border-border/20 p-8 rounded-3xl shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-[hsl(var(--brand-coral))]/10 to-[hsl(var(--brand-green))]/10 rounded-2xl flex items-center justify-center mb-6">
                <feature.icon className="w-7 h-7 text-[hsl(var(--brand-coral))]" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
