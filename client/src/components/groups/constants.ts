export const GROUP_TYPE_COLORS: Record<string, string> = {
  "Business": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Social Enterprise": "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "Creative / Arts": "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  "Community Organisation": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Iwi / Hapū": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "Government / Council": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Education / Training": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "Health / Social Services": "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "Funder": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Corporate / Sponsor": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "Resident Company": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "NGO": "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  "Uncategorised": "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export const ENGAGEMENT_COLORS: Record<string, string> = {
  "Active": "bg-green-500/10 text-green-700 dark:text-green-300",
  "Occasional": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  "Dormant": "bg-gray-500/10 text-gray-700 dark:text-gray-300",
};

export function displayGroupType(group: { type: string }): string {
  return group.type;
}

export const MEMBER_ROLES = ["Lead Contact", "Representative", "Member", "Coordinator", "Director", "Trustee"] as const;
