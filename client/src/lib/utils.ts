import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeSlot(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function getAgreementAllowanceUsage(
  bookings: any[] | undefined,
  agreementType: "membership" | "mou",
  agreementId: number,
  allowancePeriod: string | null | undefined
): number {
  if (!bookings || !agreementId) return 0;
  const now = new Date();
  const period = allowancePeriod || "quarterly";
  let periodStart: Date;
  if (period === "monthly") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "quarterly") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    periodStart = new Date(now.getFullYear(), q, 1);
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1);
  }
  return bookings.filter((b: any) => {
    const match = agreementType === "membership" ? b.membershipId === agreementId : b.mouId === agreementId;
    if (!match) return false;
    if (b.status === "cancelled" || b.status === "enquiry") return false;
    const bookingDate = b.startDate ? new Date(b.startDate) : new Date(b.createdAt);
    return bookingDate >= periodStart;
  }).length;
}

export function getPeriodLabel(period: string | null | undefined): string {
  const p = period || "quarterly";
  return p === "monthly" ? "month" : p === "quarterly" ? "quarter" : "year";
}
