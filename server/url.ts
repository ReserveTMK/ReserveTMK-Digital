export function getBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT === "1") {
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(",").map(d => d.trim()).filter(Boolean);
      const customDomain = domains.find(d => !d.endsWith(".replit.app") && !d.endsWith(".replit.dev"));
      if (customDomain) return `https://${customDomain}`;
      if (domains[0]) return `https://${domains[0]}`;
    }
    return "https://reservetmkdigital.com";
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  return "https://reservetmkdigital.com";
}
