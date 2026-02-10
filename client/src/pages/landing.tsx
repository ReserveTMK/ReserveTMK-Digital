import { Button } from "@/components/ui/beautiful-button";
import { BrainCircuit, Mic, TrendingUp, Users } from "lucide-react";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl opacity-60" />
      </div>

      <nav className="relative z-10 container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-xl">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-xl">Mentorship<span className="text-primary">AI</span></span>
        </div>
        <Button onClick={handleLogin} className="shadow-lg">Login / Sign Up</Button>
      </nav>

      <main className="relative z-10 container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium text-secondary-foreground mb-4 border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            AI-Powered Mentorship Tracking
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground leading-[1.1]">
            Track Growth, <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-500 to-indigo-600">
              Measure Impact.
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Record voice notes from your mentorship sessions and let our AI extract key insights on mindset, skill, and confidence shifts automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" variant="premium" onClick={handleLogin} className="text-lg px-10 h-14">
              Start Tracking Now
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 h-14 bg-background/50 backdrop-blur-sm">
              View Demo
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
              title: "Growth Analytics",
              desc: "Visualize confidence, skill, and mindset shifts over time with beautiful charts."
            },
            {
              icon: Users,
              title: "Contact Management",
              desc: "Organize mentees, business owners, and innovators in one centralized hub."
            }
          ].map((feature, i) => (
            <div key={i} className="bg-card/50 backdrop-blur-sm border border-white/20 p-8 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mb-6">
                <feature.icon className="w-7 h-7 text-primary" />
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
