import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVenueInstructions } from "@/hooks/use-bookings";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  Star,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { type Venue, type VenueInstruction } from "@shared/schema";
import { DEFAULT_SURVEY_QUESTIONS, type SurveyQuestion } from "./survey-settings";

export function HirerPreviewDialog({ open, onOpenChange, venues }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
}) {
  const { data: instructions } = useVenueInstructions();
  const { data: surveySettings } = useQuery<{
    questions: SurveyQuestion[] | null;
    googleReviewUrl: string | null;
    emailSubject: string | null;
    emailIntro: string | null;
    emailSignoff: string | null;
  }>({ queryKey: ['/api/survey-settings'] });
  const { data: xeroStatus } = useQuery<{
    connected: boolean;
    organisationName: string | null;
  }>({ queryKey: ['/api/xero/status'] });

  const activeInstructions = useMemo(() => {
    if (!instructions) return {};
    const grouped: Record<string, VenueInstruction[]> = {};
    instructions
      .filter(i => i.isActive)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .forEach(inst => {
        if (!grouped[inst.instructionType]) grouped[inst.instructionType] = [];
        grouped[inst.instructionType].push(inst);
      });
    return grouped;
  }, [instructions]);

  const questions = surveySettings?.questions && surveySettings.questions.length > 0
    ? surveySettings.questions
    : DEFAULT_SURVEY_QUESTIONS;

  const sampleVenue = venues[0]?.name || "Main Space";
  const sampleDate = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "EEEE d MMMM yyyy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Hirer Preview
          </DialogTitle>
          <DialogDescription>
            See what your hirers will experience — confirmation email, survey, and invoicing.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="confirmation-email">
          <TabsList className="flex-wrap">
            <TabsTrigger value="confirmation-email" data-testid="tab-preview-email">Confirmation Email</TabsTrigger>
            <TabsTrigger value="survey" data-testid="tab-preview-survey">Survey</TabsTrigger>
            <TabsTrigger value="invoice" data-testid="tab-preview-invoice">Invoice</TabsTrigger>
          </TabsList>

          <TabsContent value="confirmation-email" className="mt-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-[#1e40af] text-white text-center py-6 px-4">
                <h2 className="text-lg font-bold">Booking Confirmed!</h2>
                <p className="text-blue-200 text-sm mt-1">ReserveTMK Digital</p>
              </div>
              <div className="p-6 space-y-4 bg-white dark:bg-card">
                <div>
                  <p className="text-base text-foreground">Hi <span className="font-medium">[Hirer Name]</span>,</p>
                  <p className="text-sm text-muted-foreground mt-2">Your venue hire booking is confirmed!</p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-4 space-y-1">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-sm mb-2">Booking Details</h3>
                  <p className="text-sm"><span className="font-medium">Space:</span> {sampleVenue}</p>
                  <p className="text-sm"><span className="font-medium">Date:</span> {sampleDate} <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-semibold ml-1">IN 7 DAYS</span></p>
                  <p className="text-sm"><span className="font-medium">Time:</span> 10:00 AM - 2:00 PM (4 hours)</p>
                  <p className="text-sm"><span className="font-medium">Total:</span> $120.00 + GST</p>
                </div>

                {(activeInstructions["access"] || []).length > 0 && (
                  <div className="border-l-4 border-blue-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-2">Access Information</h3>
                    {activeInstructions["access"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-l-4 border-blue-500 bg-gray-50 dark:bg-muted/30 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-2">Arrival</h3>
                  <p className="text-sm"><span className="font-medium">ReserveTMK Digital Hub</span></p>
                  <p className="text-sm text-muted-foreground">133a Line Road, Glen Innes, Auckland 1072</p>
                  <p className="text-sm text-muted-foreground">Free parking available</p>
                </div>

                {(activeInstructions["opening"] || []).length > 0 && (
                  <div className="border-l-4 border-green-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-green-800 dark:text-green-300 mb-2">Opening Procedure</h3>
                    {activeInstructions["opening"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(activeInstructions["closing"] || []).length > 0 && (
                  <div className="border-l-4 border-amber-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">Closing Procedure</h3>
                    {activeInstructions["closing"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(activeInstructions["emergency"] || []).length > 0 && (
                  <div className="border-l-4 border-red-500 bg-gray-50 dark:bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300 mb-2">Emergency Contacts</h3>
                    {activeInstructions["emergency"].map(inst => (
                      <div key={inst.id} className="mb-2">
                        {inst.title && <p className="text-sm font-medium">{inst.title}</p>}
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{inst.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Questions or need to make changes?</p>
                  <p className="text-sm text-muted-foreground">Reply to this email or call <span className="font-medium">021 022 98172</span></p>
                  <p className="text-sm text-muted-foreground mt-3">Nga mihi,<br /><span className="font-medium">ReserveTMK Digital Team</span></p>
                </div>

                <div className="bg-gray-50 dark:bg-muted/30 text-center py-3 rounded-b-lg">
                  <p className="text-xs text-muted-foreground">ReserveTMK Digital Hub • 133a Line Road, Glen Innes, Auckland 1072</p>
                </div>
              </div>
            </div>
            {!instructions?.some(i => i.isActive) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No active venue instructions. Add some in the Venue Instructions settings tab.
              </p>
            )}
          </TabsContent>

          <TabsContent value="survey" className="mt-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-[#1e40af] text-white text-center py-6 px-4">
                <h2 className="text-lg font-bold">How was your experience?</h2>
                <p className="text-blue-200 text-sm mt-1">ReserveTMK Digital</p>
              </div>
              <div className="p-6 bg-white dark:bg-card">
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">Subject:</span>{" "}
                  {surveySettings?.emailSubject || "How was your experience at ReserveTMK Digital?"}
                </p>
                <div className="border-b pb-4 mb-4">
                  <p className="text-sm text-muted-foreground italic">
                    {surveySettings?.emailIntro || "Thanks for using our space! We'd love to hear about your experience. It'll only take 2 minutes."}
                  </p>
                </div>

                <div className="space-y-5">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-1.5" data-testid={`preview-question-${q.id}`}>
                      <p className="text-sm font-medium">
                        {idx + 1}. {q.question}
                        {q.required && <span className="text-red-500 ml-0.5">*</span>}
                      </p>
                      {q.type === "rating" && (
                        <div className="flex gap-1">
                          {Array.from({ length: q.scale || 5 }, (_, i) => (
                            <Star key={i} className={`w-6 h-6 ${i < 3 ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1 self-center">3/{q.scale || 5}</span>
                        </div>
                      )}
                      {q.type === "yes_no" && (
                        <div className="flex gap-2">
                          <Badge className="bg-primary text-primary-foreground px-3 py-1"><ThumbsUp className="w-3 h-3 mr-1" /> Yes</Badge>
                          <Badge variant="outline" className="px-3 py-1"><ThumbsDown className="w-3 h-3 mr-1" /> No</Badge>
                        </div>
                      )}
                      {q.type === "text" && (
                        <div className="border rounded-md p-3 text-sm text-muted-foreground italic bg-muted/20 min-h-[60px]">
                          Type your answer here...
                        </div>
                      )}
                      {q.type === "testimonial" && (
                        <div className="space-y-2">
                          <div className="border rounded-md p-3 text-sm text-muted-foreground italic bg-muted/20 min-h-[60px]">
                            Share your experience...
                          </div>
                          {q.subtext && <p className="text-[10px] text-muted-foreground">{q.subtext}</p>}
                          {surveySettings?.googleReviewUrl && (
                            <p className="text-xs text-primary">
                              <ExternalLink className="w-3 h-3 inline mr-1" />
                              Leave a Google review
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t">
                  <div className="bg-primary text-primary-foreground text-center py-2.5 px-6 rounded-md text-sm font-semibold inline-block">
                    Submit Survey
                  </div>
                </div>

                {surveySettings?.emailSignoff && (
                  <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line">{surveySettings.emailSignoff}</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invoice" className="mt-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-gray-800 text-white py-4 px-6 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">INVOICE</h2>
                  <p className="text-gray-300 text-xs mt-0.5">Generated via Xero</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">ReserveTMK Digital</p>
                  <p className="text-xs text-gray-400">133a Line Road, Glen Innes</p>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-card space-y-5">
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
                    <p className="font-medium">[Hirer Name]</p>
                    <p className="text-muted-foreground text-xs">[Hirer Email]</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invoice Details</p>
                    <p className="text-xs"><span className="text-muted-foreground">Invoice #:</span> INV-0042</p>
                    <p className="text-xs"><span className="text-muted-foreground">Date:</span> {format(new Date(), "d MMM yyyy")}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Due:</span> {format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "d MMM yyyy")}</p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium uppercase">Description</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium uppercase">Qty</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium uppercase">Rate</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3">
                        <p className="font-medium">{sampleVenue} Hire</p>
                        <p className="text-xs text-muted-foreground">{sampleDate}</p>
                        <p className="text-xs text-muted-foreground">10:00 AM - 2:00 PM</p>
                      </td>
                      <td className="py-3 text-right">4 hrs</td>
                      <td className="py-3 text-right">$30.00</td>
                      <td className="py-3 text-right font-medium">$120.00</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-48 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>$120.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST (15%)</span>
                      <span>$18.00</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-semibold">
                      <span>Total</span>
                      <span>$138.00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-md p-4 text-xs space-y-2">
                  <p className="font-medium text-sm">How it works:</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">1.</span> When a venue hire is confirmed, an invoice is auto-generated in Xero</p>
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">2.</span> The hirer receives the invoice via Xero email with payment details</p>
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">3.</span> Koha, package credits, and $0 bookings are skipped (no invoice)</p>
                    <p className="flex items-start gap-2"><span className="font-semibold text-foreground shrink-0">4.</span> Discounted rates are applied automatically based on booker tier</p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-md border text-sm ${xeroStatus?.connected ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"}`}>
                  {xeroStatus?.connected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-green-800 dark:text-green-200">Connected to {xeroStatus.organisationName || "Xero"} — invoices will auto-generate</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-amber-800 dark:text-amber-200">Xero not connected — connect in the Xero tab to enable auto-invoicing</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
