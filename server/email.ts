import { getUncachableGmailClient } from "./replit_integrations/gmail/client";
import { storage } from "./storage";
import type { Booking, VenueInstruction, RegularBooker } from "@shared/schema";

async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  const gmail = await getUncachableGmailClient();

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    htmlBody,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "TBC";
  const d = new Date(date);
  return d.toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  });
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function groupInstructions(instructions: VenueInstruction[]): Record<string, VenueInstruction[]> {
  const groups: Record<string, VenueInstruction[]> = {};
  for (const inst of instructions) {
    if (!inst.isActive) continue;
    const key = inst.instructionType;
    if (!groups[key]) groups[key] = [];
    groups[key].push(inst);
  }
  return groups;
}

function buildInstructionSection(title: string, instructions: VenueInstruction[]): string {
  if (!instructions || instructions.length === 0) return "";
  const items = instructions.map(i => {
    const heading = i.title ? `<strong>${i.title}</strong><br>` : "";
    return `${heading}${(i.content || "").replace(/\n/g, "<br>")}`;
  }).join("<br><br>");

  return `
    <tr><td style="padding:20px 30px 5px;background:#f8f9fa;border-left:4px solid #2563eb;">
      <h3 style="margin:0;color:#1e40af;font-size:14px;text-transform:uppercase;letter-spacing:1px;">${title}</h3>
    </td></tr>
    <tr><td style="padding:10px 30px 20px;background:#f8f9fa;border-left:4px solid #2563eb;">
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${items}</p>
    </td></tr>
  `;
}

export async function sendBookingConfirmationEmail(booking: Booking, userId: string): Promise<void> {
  if (!booking.bookerId) throw new Error("Booking has no booker contact");

  const contact = await storage.getContact(booking.bookerId);
  if (!contact?.email) throw new Error("Contact has no email address");

  const venues = await storage.getVenues(userId);
  const venue = venues.find(v => v.id === booking.venueId);
  const instructions = await storage.getVenueInstructions(userId);
  const grouped = groupInstructions(instructions);

  let regularBooker: RegularBooker | undefined;
  if (booking.bookerId) {
    regularBooker = await storage.getRegularBookerByContactId(booking.bookerId);
  }

  const clientName = contact.name || contact.email;
  const venueName = venue?.name || "Reserve Tāmaki Space";
  const dateStr = formatDate(booking.startDate);
  const startStr = formatTime(booking.startTime);
  const endStr = formatTime(booking.endTime);

  let pricingHtml = "";
  if (regularBooker?.pricingTier === "free_koha") {
    pricingHtml = `
      <p style="margin:5px 0;"><strong>Arrangement:</strong> Koha/MOU (No charge)</p>
      ${regularBooker.kohaMouNotes ? `<p style="margin:5px 0;color:#6b7280;font-style:italic;">${regularBooker.kohaMouNotes}</p>` : ""}
    `;
  } else if (booking.usePackageCredit) {
    pricingHtml = `<p style="margin:5px 0;"><strong>Total:</strong> $0 (using prepaid package credit)</p>`;
    if (regularBooker) {
      const remaining = (regularBooker.packageTotalBookings || 0) - ((regularBooker.packageUsedBookings || 0) + 1);
      pricingHtml += `<p style="margin:5px 0;color:#6b7280;">${remaining} bookings remaining in package</p>`;
    }
  } else {
    const amount = parseFloat(booking.amount || "0");
    if (regularBooker?.pricingTier === "discounted") {
      const discountPct = parseFloat(regularBooker.discountPercentage || "0");
      pricingHtml = `
        <p style="margin:5px 0;"><strong>Total:</strong> $${amount.toFixed(2)} + GST</p>
        ${discountPct > 0 ? `<p style="margin:5px 0;color:#6b7280;">Community discount (${discountPct}%) applied</p>` : ""}
      `;
    } else {
      pricingHtml = amount > 0 ? `<p style="margin:5px 0;"><strong>Total:</strong> $${amount.toFixed(2)} + GST</p>` : "";
    }
  }

  let packageHtml = "";
  if (regularBooker?.hasBookingPackage) {
    const remaining = (regularBooker.packageTotalBookings || 0) - (regularBooker.packageUsedBookings || 0);
    packageHtml = `<p style="margin:5px 0;color:#6b7280;">Package Status: ${remaining} bookings remaining</p>`;
  }

  const specialRequestsHtml = booking.specialRequests
    ? `<tr><td style="padding:10px 30px;"><p style="margin:0;"><strong>Your Special Requests:</strong><br>${booking.specialRequests.replace(/\n/g, "<br>")}</p></td></tr>`
    : "";

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#1e40af;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Booking Confirmed!</h1>
    <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Reserve Tāmaki</p>
  </td></tr>

  <tr><td style="padding:25px 30px 10px;">
    <p style="margin:0;font-size:16px;color:#111827;">Hi ${clientName},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">Your venue hire booking is confirmed!</p>
  </td></tr>

  <tr><td style="padding:10px 30px;">
    <table width="100%" style="background:#eff6ff;border-radius:6px;padding:15px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding:15px;">
        <h3 style="margin:0 0 10px;color:#1e40af;">Booking Details</h3>
        <p style="margin:5px 0;"><strong>Space:</strong> ${venueName}</p>
        <p style="margin:5px 0;"><strong>Date:</strong> ${dateStr}</p>
        <p style="margin:5px 0;"><strong>Time:</strong> ${startStr} - ${endStr}</p>
        ${pricingHtml}
        ${packageHtml}
      </td></tr>
    </table>
  </td></tr>

  ${specialRequestsHtml}

  ${buildInstructionSection("Access Information", grouped["access"] || [])}
  ${buildInstructionSection("Arrival", grouped["arrival"] || [])}
  ${buildInstructionSection("What's Included", grouped["general"] || [])}
  ${buildInstructionSection("Before You Leave", grouped["departure"] || [])}
  ${buildInstructionSection("Emergency Contacts", grouped["emergency"] || [])}

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:14px;color:#374151;">Questions or need to make changes?<br>Reply to this email or call <strong>021 022 98172</strong></p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">See you on ${dateStr}!</p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Ng\u0101 mihi,<br><strong>Reserve T\u0101maki Team</strong></p>
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Reserve T\u0101maki Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  const subject = `Booking Confirmed - Reserve T\u0101maki ${venueName} on ${dateStr}`;
  await sendEmail(contact.email, subject, htmlBody);
}

export async function sendSurveyEmail(
  contactEmail: string,
  contactName: string,
  bookingDate: Date | string | null | undefined,
  surveyToken: string
): Promise<void> {
  const dateStr = formatDate(bookingDate);
  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG
    ? `https://${process.env.REPL_SLUG}.replit.app`
    : "https://app.reservetmk.co.nz";

  const surveyUrl = `${baseUrl}/survey/${surveyToken}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#1e40af;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">How was your experience?</h1>
    <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Reserve T\u0101maki</p>
  </td></tr>

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:16px;color:#111827;">Hi ${contactName},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">Thanks for using our space on ${dateStr}!</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">We'd love to hear about your experience. It'll only take 2 minutes.</p>

    <div style="text-align:center;margin:25px 0;">
      <a href="${surveyUrl}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Take Survey</a>
    </div>

    <p style="margin:10px 0;font-size:14px;color:#374151;">Your feedback helps us improve and helps other wh\u0101nau find great spaces.</p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Ng\u0101 mihi,<br><strong>Reserve T\u0101maki Team</strong></p>
    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">P.S. If you had a great experience, we'd love a testimonial!</p>
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Reserve T\u0101maki Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  const subject = "How was your experience at Reserve T\u0101maki?";
  await sendEmail(contactEmail, subject, htmlBody);
}
