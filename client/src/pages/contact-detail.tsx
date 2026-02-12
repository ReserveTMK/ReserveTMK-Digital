import { Sidebar } from "@/components/layout/sidebar";
import { useContact } from "@/hooks/use-contacts";
import { useInteractions, useCreateInteraction, useAnalyzeInteraction } from "@/hooks/use-interactions";
import { Button } from "@/components/ui/beautiful-button";
import { MetricCard } from "@/components/ui/metric-card";
import { useRoute } from "wouter";
import { Loader2, Mic, StopCircle, ArrowLeft, Brain, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";

export default function ContactDetail() {
  const [match, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");
  const { data: contact, isLoading: contactLoading } = useContact(id);
  const { data: interactions, isLoading: interactionsLoading } = useInteractions(id);

  if (contactLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background/50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-screen items-center justify-center bg-background/50 flex-col gap-4">
        <h1 className="text-2xl font-bold">Contact not found</h1>
        <Link href="/contacts"><Button>Go Back</Button></Link>
      </div>
    );
  }

  // Prepare chart data from interactions history
  // Sort interactions by date ascending
  const chartData = [...(interactions || [])]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(i => ({
      date: format(new Date(i.date), 'MM/dd'),
      mindset: i.analysis?.mindsetScore || 0,
      skill: i.analysis?.skillScore || 0,
      confidence: i.analysis?.confidenceScore || 0,
    }));

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="space-y-4">
            <Link href="/contacts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Contacts
            </Link>
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-4xl shadow-inner">
                  {contact.name[0]}
                </div>
                <div>
                  <h1 className="text-4xl font-display font-bold text-foreground">{contact.name}</h1>
                  <p className="text-muted-foreground text-lg">{contact.role}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {contact.age && <span>{contact.age} years old</span>}
                    {contact.ethnicity && <span>{contact.ethnicity}</span>}
                    {contact.location && <span>{contact.location}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {contact.tags?.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-secondary rounded-md text-xs font-medium text-secondary-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="shadow-lg shadow-primary/20">
                    <Mic className="w-4 h-4 mr-2" /> Log Interaction
                  </Button>
                </DialogTrigger>
                <LogInteractionDialog contactId={id} />
              </Dialog>
            </div>
          </div>

          {/* Current Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard 
              title="Mindset Score" 
              value={contact.metrics?.mindset || "-"} 
              icon={<Brain className="w-5 h-5" />} 
              color="primary"
            />
            <MetricCard 
              title="Skill Level" 
              value={contact.metrics?.skill || "-"} 
              icon={<Sparkles className="w-5 h-5" />} 
              color="secondary"
            />
            <MetricCard 
              title="Confidence" 
              value={contact.metrics?.confidence || "-"} 
              icon={<TrendingUp className="w-5 h-5" />} 
              color="green"
            />
          </div>

          {/* Tabs Content */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card border border-border p-1 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Overview</TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Growth Trajectory
                </h3>
                <div className="h-[300px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="mindset" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                        <Line type="monotone" dataKey="skill" stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                        <Line type="monotone" dataKey="confidence" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <p>No enough data to show trends.</p>
                      <p className="text-sm">Log some interactions to see progress.</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
               {interactionsLoading ? (
                 <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
               ) : interactions?.length === 0 ? (
                 <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                   No interactions logged yet.
                 </div>
               ) : (
                 <div className="grid gap-4">
                   {interactions?.map((interaction) => (
                     <div key={interaction.id} className="bg-card p-6 rounded-2xl border border-border hover:shadow-md transition-all">
                       <div className="flex justify-between items-start mb-3">
                         <div>
                           <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                             {interaction.type}
                           </span>
                           <h4 className="font-bold text-lg">{format(new Date(interaction.date), 'MMMM d, yyyy')}</h4>
                         </div>
                         <div className="flex gap-2">
                           {interaction.analysis?.keyInsights?.map((insight, i) => (
                             <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
                               {insight}
                             </span>
                           ))}
                         </div>
                       </div>
                       
                       <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                         {interaction.summary || interaction.transcript}
                       </p>
                       
                       <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
                         <div className="text-center">
                           <p className="text-xs text-muted-foreground mb-1">Mindset</p>
                           <p className="font-bold text-lg text-primary">{interaction.analysis?.mindsetScore || "-"}</p>
                         </div>
                         <div className="text-center border-l border-border">
                           <p className="text-xs text-muted-foreground mb-1">Skill</p>
                           <p className="font-bold text-lg text-secondary-foreground">{interaction.analysis?.skillScore || "-"}</p>
                         </div>
                         <div className="text-center border-l border-border">
                           <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                           <p className="font-bold text-lg text-amber-500">{interaction.analysis?.confidenceScore || "-"}</p>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function LogInteractionDialog({ contactId }: { contactId: number }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const { mutate: analyze, isPending: isAnalyzing } = useAnalyzeInteraction();
  const { mutate: createInteraction, isPending: isSaving } = useCreateInteraction();
  
  // Staging state for analysis results before saving
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  useEffect(() => {
    // Setup Web Speech API if available
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      // @ts-ignore
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + " " + finalTranscript);
        }
      };
      
      setRecognition(recognition);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
      setIsRecording(false);
    } else {
      if (!recognition) {
        alert("Voice recording not supported in this browser.");
        return;
      }
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleAnalyze = () => {
    if (!transcript.trim()) return;
    analyze({ text: transcript }, {
      onSuccess: (data) => {
        setAnalysisResult(data);
      }
    });
  };

  const handleSave = () => {
    if (!analysisResult) return;
    
    createInteraction({
      contactId,
      date: new Date(),
      type: "Voice Note",
      transcript: transcript,
      summary: analysisResult.summary,
      analysis: {
        mindsetScore: analysisResult.metrics.mindset,
        skillScore: analysisResult.metrics.skill,
        confidenceScore: analysisResult.metrics.confidence,
        keyInsights: analysisResult.keywords
      },
      keywords: analysisResult.keywords
    });
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Log Interaction</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6 py-4">
        {!analysisResult ? (
          <>
            <div className="space-y-2">
              <Label>Voice Input</Label>
              <div className="flex gap-4">
                <Button 
                  type="button" 
                  variant={isRecording ? "destructive" : "secondary"} 
                  onClick={toggleRecording}
                  className={isRecording ? "animate-pulse" : ""}
                >
                  {isRecording ? (
                    <><StopCircle className="w-4 h-4 mr-2" /> Stop Recording</>
                  ) : (
                    <><Mic className="w-4 h-4 mr-2" /> Start Recording</>
                  )}
                </Button>
                <div className="text-xs text-muted-foreground flex items-center">
                  {isRecording ? "Listening..." : "Click to record or type below"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript / Notes</Label>
              <Textarea 
                id="transcript" 
                value={transcript} 
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Speak or type your session notes here..."
                className="min-h-[150px] resize-none text-base p-4 bg-muted/30"
              />
            </div>
            
            <Button 
              onClick={handleAnalyze} 
              isLoading={isAnalyzing} 
              disabled={!transcript.trim()} 
              className="w-full"
            >
              Analyze with AI
            </Button>
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
              <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI Analysis
              </h3>
              <p className="text-sm text-foreground/80 mb-4">{analysisResult.summary}</p>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-background rounded-lg p-3 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Mindset</div>
                  <div className="font-bold text-xl text-primary">{analysisResult.metrics.mindset}</div>
                </div>
                <div className="bg-background rounded-lg p-3 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Skill</div>
                  <div className="font-bold text-xl text-secondary-foreground">{analysisResult.metrics.skill}</div>
                </div>
                <div className="bg-background rounded-lg p-3 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="font-bold text-xl text-amber-500">{analysisResult.metrics.confidence}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {analysisResult.keywords.map((k: string, i: number) => (
                  <span key={i} className="text-xs bg-background px-2 py-1 rounded-md border border-border text-muted-foreground">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAnalysisResult(null)} className="flex-1">
                Edit Notes
              </Button>
              <Button onClick={handleSave} isLoading={isSaving} className="flex-[2]">
                Save Interaction
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}
