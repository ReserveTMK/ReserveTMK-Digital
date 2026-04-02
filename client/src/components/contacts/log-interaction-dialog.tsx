import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAnalyzeInteraction, useCreateInteraction } from "@/hooks/use-interactions";
import { Mic, StopCircle, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

export interface LogInteractionDialogProps {
  contactId: number;
}

export function LogInteractionDialog({ contactId }: LogInteractionDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const { mutate: analyze, isPending: isAnalyzing } = useAnalyzeInteraction();
  const { mutate: createInteraction, isPending: isSaving } = useCreateInteraction();

  const [analysisResult, setAnalysisResult] = useState<any>(null);

  useEffect(() => {
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
        bizConfidenceScore: analysisResult.metrics.bizConfidence,
        systemsInPlaceScore: analysisResult.metrics.systemsInPlace,
        fundingReadinessScore: analysisResult.metrics.fundingReadiness,
        networkStrengthScore: analysisResult.metrics.networkStrength,
        communityImpactScore: analysisResult.metrics.communityImpact,
        keyInsights: analysisResult.keywords
      },
      keywords: analysisResult.keywords
    });
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Log Interaction</DialogTitle>
        <DialogDescription className="sr-only">Log a new interaction with this contact</DialogDescription>
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

              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Mindset</div>
                  <div className="font-bold text-lg text-primary">{analysisResult.metrics.mindset}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Skill</div>
                  <div className="font-bold text-lg text-secondary-foreground">{analysisResult.metrics.skill}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="font-bold text-lg text-amber-500">{analysisResult.metrics.confidence}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Biz Conf.</div>
                  <div className="font-bold text-lg text-pink-500">{analysisResult.metrics.bizConfidence}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Systems</div>
                  <div className="font-bold text-lg text-cyan-500">{analysisResult.metrics.systemsInPlace}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Funding</div>
                  <div className="font-bold text-lg text-teal-500">{analysisResult.metrics.fundingReadiness}</div>
                </div>
                <div className="bg-background rounded-lg p-2 text-center border border-border shadow-sm">
                  <div className="text-xs text-muted-foreground">Network</div>
                  <div className="font-bold text-lg text-orange-500">{analysisResult.metrics.networkStrength}</div>
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
