import { getUncachableGmailClient } from "./replit_integrations/gmail/client";
import { storage } from "./storage";
import { getBaseUrl } from "./url";
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

function getCountdownText(date: Date | string | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const nzNow = new Date(now.toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
  const bookingDate = new Date(date);
  const nzBooking = new Date(bookingDate.toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
  nzNow.setHours(0, 0, 0, 0);
  nzBooking.setHours(0, 0, 0, 0);
  const diffMs = nzBooking.getTime() - nzNow.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  if (diffDays > 1 && diffDays <= 14) return `IN ${diffDays} DAYS`;
  return "";
}

function getDurationLabel(booking: Booking): string {
  if (booking.durationType === "full_day") return "Full Day";
  if (booking.durationType === "half_day") return "Half Day";
  if (booking.startTime && booking.endTime) {
    const [sh, sm] = booking.startTime.split(":").map(Number);
    const [eh, em] = booking.endTime.split(":").map(Number);
    const hours = (eh * 60 + em - sh * 60 - sm) / 60;
    if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return "";
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

async function getBookingLocationInstructions(booking: Booking, userId: string, bookingVenues: any[]): Promise<VenueInstruction[]> {
  const locationAccess = booking.locationAccess as string[] | null;
  if (locationAccess && locationAccess.length > 0) {
    const allInstructions: VenueInstruction[] = [];
    for (const spaceName of locationAccess) {
      const spaceInstructions = await storage.getVenueInstructionsBySpaceName(userId, spaceName);
      allInstructions.push(...spaceInstructions);
    }
    return allInstructions;
  }
  const spaceNames = [...new Set(bookingVenues.map(v => v.spaceName).filter(Boolean))];
  if (spaceNames.length > 0) {
    const allInstructions: VenueInstruction[] = [];
    for (const spaceName of spaceNames) {
      const spaceInstructions = await storage.getVenueInstructionsBySpaceName(userId, spaceName);
      allInstructions.push(...spaceInstructions);
    }
    return allInstructions;
  }
  return await storage.getVenueInstructions(userId);
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
  const bookingVenueIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
  const bookingVenues = venues.filter(v => bookingVenueIds.includes(v.id));
  const venue = bookingVenues[0];
  const instructions = await getBookingLocationInstructions(booking, userId, bookingVenues);
  const grouped = groupInstructions(instructions);

  let regularBooker: RegularBooker | undefined;
  if (booking.bookerId) {
    regularBooker = await storage.getRegularBookerByContactId(booking.bookerId);
  }

  const clientName = contact.name || contact.email;
  const venueName = venue?.name || "Reserve T\u0101maki Space";
  const dateStr = formatDate(booking.startDate);
  const startStr = formatTime(booking.startTime);
  const endStr = formatTime(booking.endTime);
  const countdown = getCountdownText(booking.startDate);
  const countdownBadge = countdown
    ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px;">${countdown}</span>`
    : "";
  const durationLabel = getDurationLabel(booking);
  const durationText = durationLabel ? ` (${durationLabel})` : "";

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

  const bookingSummaryHtml = booking.bookingSummary
    ? `
    <tr><td style="padding:15px 30px;">
      <table width="100%" style="background:#fefce8;border-radius:6px;border:1px solid #fde68a;" cellpadding="0" cellspacing="0">
        <tr><td style="padding:12px 15px;">
          <p style="margin:0 0 5px;font-size:13px;font-weight:600;color:#92400e;">Tell Us About Your Booking</p>
          <p style="margin:0;font-size:14px;color:#374151;">${booking.bookingSummary.replace(/\n/g, "<br>")}</p>
        </td></tr>
      </table>
    </td></tr>`
    : "";

  const classificationText = booking.classification ? `<p style="margin:5px 0;"><strong>Type:</strong> ${booking.classification}</p>` : "";

  const arrivalSection = `
    <tr><td style="padding:20px 30px 5px;background:#f8f9fa;border-left:4px solid #2563eb;">
      <h3 style="margin:0;color:#1e40af;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Arrival</h3>
    </td></tr>
    <tr><td style="padding:10px 30px 20px;background:#f8f9fa;border-left:4px solid #2563eb;">
      <p style="margin:0 0 5px;color:#374151;font-size:14px;line-height:1.6;">
        <strong>Reserve T\u0101maki Hub</strong><br>
        133a Line Road, Glen Innes, Auckland 1072<br>
        <span style="color:#6b7280;">Free parking available</span>
      </p>
    </td></tr>
  `;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#1e40af;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Booking Confirmed!</h1>
    <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Reserve T\u0101maki</p>
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
        <p style="margin:5px 0;"><strong>Date:</strong> ${dateStr}${countdownBadge}</p>
        <p style="margin:5px 0;"><strong>Time:</strong> ${startStr} - ${endStr}${durationText}</p>
        ${classificationText}
        ${pricingHtml}
        ${packageHtml}
      </td></tr>
    </table>
  </td></tr>

  ${bookingSummaryHtml}

  ${buildInstructionSection("Access Information", grouped["access"] || [])}
  ${arrivalSection}
  ${buildInstructionSection("Opening Procedure", grouped["opening"] || [])}
  ${buildInstructionSection("Closing Procedure", grouped["closing"] || [])}
  ${buildInstructionSection("Emergency Contacts", grouped["emergency"] || [])}

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:14px;color:#374151;">Questions or need to make changes?<br>Reply to this email or call <strong>021 022 98172</strong></p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">See you ${countdown === "TOMORROW" ? "tomorrow" : countdown === "TODAY" ? "today" : `on ${dateStr}`}!</p>
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

export async function sendAfterHoursReminderEmail(booking: Booking, userId: string): Promise<void> {
  if (!booking.bookerId) throw new Error("Booking has no booker contact");

  const contact = await storage.getContact(booking.bookerId);
  if (!contact?.email) throw new Error("Contact has no email address");

  const venues = await storage.getVenues(userId);
  const bookingVenueIds2 = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
  const bookingVenues2 = venues.filter(v => bookingVenueIds2.includes(v.id));
  const venue = bookingVenues2[0];
  const instructions = await getBookingLocationInstructions(booking, userId, bookingVenues2);
  const grouped = groupInstructions(instructions);

  const clientName = contact.name || contact.email;
  const venueName = venue?.name || "ReserveTMK Digital Space";
  const dateStr = formatDate(booking.startDate);
  const startStr = formatTime(booking.startTime);
  const endStr = formatTime(booking.endTime);
  const countdown = getCountdownText(booking.startDate);
  const durationLabel = getDurationLabel(booking);
  const durationText = durationLabel ? ` (${durationLabel})` : "";

  const countdownBadge = countdown
    ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px;">${countdown}</span>`
    : "";

  const afterHoursNotice = `
    <tr><td style="padding:15px 30px;">
      <table width="100%" style="background:#fef3c7;border-radius:6px;border:1px solid #fde68a;" cellpadding="0" cellspacing="0">
        <tr><td style="padding:15px;">
          <p style="margin:0 0 5px;font-size:14px;font-weight:600;color:#92400e;">After-Hours Booking - Important</p>
          <p style="margin:0;font-size:14px;color:#78350f;line-height:1.5;">Your booking is outside our regular staffed hours. The building will be unstaffed during your visit, so please read the access and departure instructions carefully. You will be responsible for locking up when you leave.</p>
        </td></tr>
      </table>
    </td></tr>`;

  const arrivalSection = `
    <tr><td style="padding:20px 30px 5px;background:#f8f9fa;border-left:4px solid #f59e0b;">
      <h3 style="margin:0;color:#92400e;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Arrival</h3>
    </td></tr>
    <tr><td style="padding:10px 30px 20px;background:#f8f9fa;border-left:4px solid #f59e0b;">
      <p style="margin:0 0 5px;color:#374151;font-size:14px;line-height:1.6;">
        <strong>ReserveTMK Digital Hub</strong><br>
        133a Line Road, Glen Innes, Auckland 1072<br>
        <span style="color:#6b7280;">Free parking available</span>
      </p>
    </td></tr>
  `;

  function buildAfterHoursSection(title: string, insts: VenueInstruction[]): string {
    if (!insts || insts.length === 0) return "";
    const items = insts.map(i => {
      const heading = i.title ? `<strong>${i.title}</strong><br>` : "";
      return `${heading}${(i.content || "").replace(/\n/g, "<br>")}`;
    }).join("<br><br>");

    return `
      <tr><td style="padding:20px 30px 5px;background:#f8f9fa;border-left:4px solid #f59e0b;">
        <h3 style="margin:0;color:#92400e;font-size:14px;text-transform:uppercase;letter-spacing:1px;">${title}</h3>
      </td></tr>
      <tr><td style="padding:10px 30px 20px;background:#f8f9fa;border-left:4px solid #f59e0b;">
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${items}</p>
      </td></tr>
    `;
  }

  const closingInstructions = grouped["closing"] || [];
  const lockUpReminder = `
    <tr><td style="padding:15px 30px;">
      <table width="100%" style="background:#fef2f2;border-radius:6px;border:1px solid #fecaca;" cellpadding="0" cellspacing="0">
        <tr><td style="padding:15px;">
          <p style="margin:0 0 5px;font-size:14px;font-weight:600;color:#991b1b;">Before You Leave - Please Lock Up</p>
          <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.5;">As this is an after-hours booking, please make sure all doors are locked, lights are off, and the building is secured before you leave.</p>
        </td></tr>
      </table>
    </td></tr>`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#92400e;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">After-Hours Booking Reminder</h1>
    <p style="margin:8px 0 0;color:#fde68a;font-size:14px;">ReserveTMK Digital</p>
  </td></tr>

  <tr><td style="padding:25px 30px 10px;">
    <p style="margin:0;font-size:16px;color:#111827;">Hi ${clientName},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">Just a reminder about your upcoming after-hours booking. Here's everything you need to know for your visit.</p>
  </td></tr>

  <tr><td style="padding:10px 30px;">
    <table width="100%" style="background:#eff6ff;border-radius:6px;padding:15px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding:15px;">
        <h3 style="margin:0 0 10px;color:#1e40af;">Booking Details</h3>
        <p style="margin:5px 0;"><strong>Space:</strong> ${venueName}</p>
        <p style="margin:5px 0;"><strong>Date:</strong> ${dateStr}${countdownBadge}</p>
        <p style="margin:5px 0;"><strong>Time:</strong> ${startStr} - ${endStr}${durationText}</p>
      </td></tr>
    </table>
  </td></tr>

  ${afterHoursNotice}

  ${buildAfterHoursSection("Access Information", grouped["access"] || [])}
  ${arrivalSection}
  ${buildAfterHoursSection("Opening Procedure", grouped["opening"] || [])}
  ${lockUpReminder}
  ${buildAfterHoursSection("Closing Procedure", grouped["closing"] || [])}
  ${buildAfterHoursSection("Emergency Contacts", grouped["emergency"] || [])}

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:14px;color:#374151;">Questions or need help?<br>Call <strong>021 022 98172</strong> (may have limited availability after hours)</p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Nga mihi,<br><strong>ReserveTMK Digital Team</strong></p>
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">ReserveTMK Digital Hub - 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  const subject = `After-Hours Reminder - ReserveTMK Digital ${venueName} ${countdown === "TODAY" ? "Today" : countdown === "TOMORROW" ? "Tomorrow" : dateStr}`;
  await sendEmail(contact.email, subject, htmlBody);
}

export async function sendBookingReminderEmail(booking: Booking, userId: string): Promise<void> {
  if (!booking.bookerId) throw new Error("Booking has no booker contact");

  const contact = await storage.getContact(booking.bookerId);
  if (!contact?.email) throw new Error("Contact has no email address");

  const venues = await storage.getVenues(userId);
  const bookingVenueIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
  const bookingVenues = venues.filter(v => bookingVenueIds.includes(v.id));
  const venue = bookingVenues[0];
  const instructions = await getBookingLocationInstructions(booking, userId, bookingVenues);
  const grouped = groupInstructions(instructions);

  const clientName = contact.name || contact.email;
  const venueName = venue?.name || "Reserve T\u0101maki Space";
  const dateStr = formatDate(booking.startDate);
  const startStr = formatTime(booking.startTime);
  const endStr = formatTime(booking.endTime);
  const countdown = getCountdownText(booking.startDate);
  const durationLabel = getDurationLabel(booking);
  const durationText = durationLabel ? ` (${durationLabel})` : "";
  const countdownBadge = countdown
    ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px;">${countdown}</span>`
    : "";

  const arrivalSection = `
    <tr><td style="padding:20px 30px 5px;background:#f8f9fa;border-left:4px solid #2563eb;">
      <h3 style="margin:0;color:#1e40af;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Arrival</h3>
    </td></tr>
    <tr><td style="padding:10px 30px 20px;background:#f8f9fa;border-left:4px solid #2563eb;">
      <p style="margin:0 0 5px;color:#374151;font-size:14px;line-height:1.6;">
        <strong>Reserve T\u0101maki Hub</strong><br>
        133a Line Road, Glen Innes, Auckland 1072<br>
        <span style="color:#6b7280;">Free parking available</span>
      </p>
    </td></tr>
  `;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#1e40af;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Booking Reminder</h1>
    <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Reserve T\u0101maki</p>
  </td></tr>

  <tr><td style="padding:25px 30px 10px;">
    <p style="margin:0;font-size:16px;color:#111827;">Hi ${clientName},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">Just a reminder about your upcoming booking. Here's everything you need to know for your visit.</p>
  </td></tr>

  <tr><td style="padding:10px 30px;">
    <table width="100%" style="background:#eff6ff;border-radius:6px;padding:15px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding:15px;">
        <h3 style="margin:0 0 10px;color:#1e40af;">Booking Details</h3>
        <p style="margin:5px 0;"><strong>Space:</strong> ${venueName}</p>
        <p style="margin:5px 0;"><strong>Date:</strong> ${dateStr}${countdownBadge}</p>
        <p style="margin:5px 0;"><strong>Time:</strong> ${startStr} - ${endStr}${durationText}</p>
      </td></tr>
    </table>
  </td></tr>

  ${buildInstructionSection("Access Information", grouped["access"] || [])}
  ${arrivalSection}
  ${buildInstructionSection("Opening Procedure", grouped["opening"] || [])}
  ${buildInstructionSection("Closing Procedure", grouped["closing"] || [])}
  ${buildInstructionSection("Emergency Contacts", grouped["emergency"] || [])}

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:14px;color:#374151;">Questions or need help?<br>Call <strong>021 022 98172</strong></p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Ng\u0101 mihi,<br><strong>Reserve T\u0101maki Team</strong></p>
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Reserve T\u0101maki Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  const subject = `Booking Reminder - Reserve T\u0101maki ${venueName} ${countdown === "TODAY" ? "Today" : countdown === "TOMORROW" ? "Tomorrow" : dateStr}`;
  await sendEmail(contact.email, subject, htmlBody);
}

export async function sendSurveyEmail(
  contactEmail: string,
  contactName: string,
  bookingDate: Date | string | null | undefined,
  surveyToken: string,
  options?: { subject?: string; intro?: string; signoff?: string }
): Promise<void> {
  const dateStr = formatDate(bookingDate);
  const baseUrl = getBaseUrl();

  const surveyUrl = `${baseUrl}/survey/${surveyToken}`;

  const introText = options?.intro
    ? options.intro.replace(/\{name\}/gi, contactName).replace(/\{date\}/gi, dateStr)
    : `Thanks for using our space on ${dateStr}!\n\nWe'd love to hear about your experience. It'll only take 2 minutes.`;

  const signoffText = options?.signoff || `Ng\u0101 mihi,\nReserve T\u0101maki Team`;

  const introHtml = introText.split("\n").map(line => 
    `<p style="margin:10px 0;font-size:14px;color:#374151;">${line || "&nbsp;"}</p>`
  ).join("");

  const signoffHtml = signoffText.split("\n").map((line, i) => 
    i === 0 ? `<p style="margin:15px 0 0;font-size:14px;color:#374151;">${line}` : `<br><strong>${line}</strong></p>`
  ).join("");

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
    ${introHtml}

    <div style="text-align:center;margin:25px 0;">
      <a href="${surveyUrl}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Take Survey</a>
    </div>

    ${signoffHtml}
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Reserve T\u0101maki Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  const subject = options?.subject || "How was your experience at Reserve T\u0101maki?";
  await sendEmail(contactEmail, subject, htmlBody);
}

export async function sendGrowthSurveyEmail(
  contactEmail: string,
  contactName: string,
  surveyToken: string,
  mentorName?: string
): Promise<void> {
  const baseUrl = getBaseUrl();
  const surveyUrl = `${baseUrl}/survey/${surveyToken}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#059669;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Growth Check-in</h1>
    <p style="margin:8px 0 0;color:#d1fae5;font-size:14px;">Reserve T\u0101maki</p>
  </td></tr>

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:16px;color:#111827;">Kia ora ${contactName},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">
      ${mentorName ? `${mentorName} would` : "We'd"} love to hear how you're tracking on your journey. This quick growth survey helps us understand where you're at and how we can best support you.
    </p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">
      It only takes a few minutes \u2014 rate yourself across a few key areas and share what's on your mind.
    </p>

    <div style="text-align:center;margin:25px 0;">
      <a href="${surveyUrl}" style="display:inline-block;padding:14px 32px;background:#059669;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Take Growth Survey</a>
    </div>

    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Ng\u0101 mihi,<br><strong>${mentorName || "Reserve T\u0101maki Team"}</strong></p>
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Reserve T\u0101maki Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  await sendEmail(contactEmail, `Growth Check-in \u2014 How are you tracking, ${contactName}?`, htmlBody);
}

export async function sendBookerLoginEmail(
  email: string,
  name: string,
  loginUrl: string
): Promise<void> {
  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#1e40af;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Your Booking Portal Login</h1>
    <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Reserve T\u0101maki</p>
  </td></tr>

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:16px;color:#111827;">Hi ${name},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">Click the button below to access your booking portal. This link is valid for 24 hours.</p>

    <div style="text-align:center;margin:25px 0;">
      <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Access Booking Portal</a>
    </div>

    <p style="margin:10px 0;font-size:14px;color:#374151;">From the portal you can view venue availability, submit booking requests, and check your package status.</p>
    <p style="margin:10px 0;font-size:12px;color:#9ca3af;">If you didn't request this link, you can safely ignore this email.</p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Ng\u0101 mihi,<br><strong>Reserve T\u0101maki Team</strong></p>
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Reserve T\u0101maki Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  const subject = "Your Reserve T\u0101maki Booking Portal Login";
  await sendEmail(email, subject, htmlBody);
}

export async function sendProgrammeReminderEmail(
  email: string,
  name: string,
  programme: {
    name: string;
    startDate: Date | string | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
  },
  directions: string | null
): Promise<void> {
  const dateStr = formatDate(programme.startDate);
  const timeStr = programme.startTime
    ? formatTime(programme.startTime) + (programme.endTime ? ` – ${formatTime(programme.endTime)}` : "")
    : null;

  const detailRows = [
    dateStr ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:80px;vertical-align:top;">Date</td><td style="padding:4px 0;font-size:14px;color:#111827;font-weight:600;">${dateStr}</td></tr>` : "",
    timeStr ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;vertical-align:top;">Time</td><td style="padding:4px 0;font-size:14px;color:#111827;font-weight:600;">${timeStr}</td></tr>` : "",
    programme.location ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;vertical-align:top;">Location</td><td style="padding:4px 0;font-size:14px;color:#111827;font-weight:600;">${programme.location}</td></tr>` : "",
  ].filter(Boolean).join("");

  const directionsHtml = directions
    ? `<tr><td style="padding:20px 30px;background:#f0fdf4;border-top:1px solid #e5e7eb;">
        <h3 style="margin:0 0 8px;font-size:14px;color:#166534;">How to find us</h3>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;">${directions}</p>
      </td></tr>`
    : "";

  const htmlBody = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#7c3aed;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Event Reminder</h1>
    <p style="margin:8px 0 0;color:#e9d5ff;font-size:14px;">ReserveTMK Digital</p>
  </td></tr>

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:16px;color:#111827;">Kia ora ${name},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">Just a reminder about the upcoming event:</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:15px 0;">
      <h2 style="margin:0 0 10px;font-size:18px;color:#111827;">${programme.name}</h2>
      <table cellpadding="0" cellspacing="0">${detailRows}</table>
    </div>

    <p style="margin:10px 0 0;font-size:14px;color:#374151;">We look forward to seeing you there!</p>
    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Ngā mihi,<br><strong>ReserveTMK Digital Team</strong></p>
  </td></tr>

  ${directionsHtml}

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">ReserveTMK Digital Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  await sendEmail(email, `Reminder: ${programme.name}`, htmlBody);
}

export async function sendProgrammeSurveyEmail(
  email: string,
  name: string,
  programmeName: string,
  surveyToken: string
): Promise<void> {
  const baseUrl = getBaseUrl();
  const surveyUrl = `${baseUrl}/survey/${surveyToken}`;

  const htmlBody = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="padding:30px;background:#7c3aed;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">How was it?</h1>
    <p style="margin:8px 0 0;color:#e9d5ff;font-size:14px;">ReserveTMK Digital</p>
  </td></tr>

  <tr><td style="padding:25px 30px;">
    <p style="margin:0;font-size:16px;color:#111827;">Kia ora ${name},</p>
    <p style="margin:10px 0;font-size:14px;color:#374151;">
      Thanks for attending <strong>${programmeName}</strong>! We'd love to hear your thoughts — it only takes a minute.
    </p>

    <div style="text-align:center;margin:25px 0;">
      <a href="${surveyUrl}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Share Your Feedback</a>
    </div>

    <p style="margin:15px 0 0;font-size:14px;color:#374151;">Ngā mihi,<br><strong>ReserveTMK Digital Team</strong></p>
  </td></tr>

  <tr><td style="padding:15px 30px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">ReserveTMK Digital Hub &bull; 133a Line Road, Glen Innes, Auckland 1072</p>
  </td></tr>
</table>
</body>
</html>`;

  await sendEmail(email, `How was ${programmeName}?`, htmlBody);
}

export async function sendSessionNotesEmail(
  menteeEmail: string,
  menteeName: string,
  sessionDate: Date,
  summary: string,
  nextSteps?: string | null
): Promise<void> {
  const dateStr = sessionDate.toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  });

  const nextStepsHtml = nextSteps
    ? `<tr><td style="padding: 20px 30px;">
        <h3 style="margin: 0 0 10px; color: #1a1a1a; font-size: 16px;">Next Steps / Homework</h3>
        <p style="margin: 0; color: #444; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${nextSteps}</p>
      </td></tr>`
    : "";

  const htmlBody = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
      <tr><td style="padding: 30px; background: #1a1a1a; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px;">Session Notes</h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: #ccc;">${dateStr}</p>
      </td></tr>
      <tr><td style="padding: 20px 30px;">
        <p style="margin: 0 0 5px; color: #888; font-size: 13px;">Kia ora ${menteeName},</p>
        <p style="margin: 0 0 15px; color: #666; font-size: 14px;">Here's a summary from our session:</p>
        <h3 style="margin: 0 0 10px; color: #1a1a1a; font-size: 16px;">Summary</h3>
        <p style="margin: 0; color: #444; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${summary}</p>
      </td></tr>
      ${nextStepsHtml}
      <tr><td style="padding: 20px 30px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #999; font-size: 12px;">Reserve T\u0101maki Mentoring</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  await sendEmail(menteeEmail, `Session Notes \u2014 ${dateStr}`, htmlBody);
}
