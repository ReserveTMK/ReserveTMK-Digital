import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-start p-4 sm:p-8">
      <Card className="w-full max-w-2xl p-6 sm:p-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Privacy at Reserve Tāmaki</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: March 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What we collect</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            When you book a space, register for a programme, or work with us through mentoring, we collect basic contact information — your name, email, and phone number. This lets us manage your booking, send confirmations, and stay in touch about things you've signed up for.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For mentoring and programme participants, we may also ask about your venture or goals so we can provide relevant support. If you attend a programme, we may ask about dietary requirements or accessibility needs to make sure you're looked after.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We ask about ethnicity in some registration forms. This is always optional and helps us report aggregate community demographics to our funders — it's never shared individually.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Why we collect it</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside leading-relaxed">
            <li>To deliver the service you've signed up for (bookings, mentoring, programmes)</li>
            <li>To send you confirmations, reminders, and follow-ups related to your booking or programme</li>
            <li>To report aggregate numbers to our funders (e.g., "45 people attended programmes this quarter") — never individual details without your consent</li>
            <li>To improve how we run the hub and support our community</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Who sees it</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your information is accessed by the Reserve Tāmaki team (Ra and Kim) for operational purposes. We share aggregate, anonymised data with our funders for reporting — for example, total attendance numbers and programme outcomes. We don't share your individual details with anyone without telling you first.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">How we keep it safe</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your data is stored securely in our platform with industry-standard encryption. We use secure authentication and access is limited to authorised team members only.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your rights</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Under the New Zealand Privacy Act 2020, you have the right to:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside leading-relaxed">
            <li>Ask what information we hold about you</li>
            <li>Request corrections to your information</li>
            <li>Ask us to stop contacting you</li>
            <li>Request deletion of your data</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To make any of these requests, email <a href="mailto:kiaora@reservetmk.co.nz" className="text-primary hover:underline">kiaora@reservetmk.co.nz</a> or talk to us at the hub.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Emails and communications</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We'll send you emails related to things you've booked or registered for — confirmations, reminders, and follow-up surveys. If you'd prefer not to receive these, reply to any email with "unsubscribe" or contact us at <a href="mailto:kiaora@reservetmk.co.nz" className="text-primary hover:underline">kiaora@reservetmk.co.nz</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Calendar events</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you attend a meeting or event with us via Google Calendar, your name and email from the calendar invite may be recorded in our system for operational tracking.
          </p>
        </section>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Reserve Tāmaki — 133a Line Road, Glen Innes, Auckland 1072
          </p>
          <p className="text-xs text-muted-foreground">
            Questions? <a href="mailto:kiaora@reservetmk.co.nz" className="text-primary hover:underline">kiaora@reservetmk.co.nz</a>
          </p>
        </div>
      </Card>
    </div>
  );
}
