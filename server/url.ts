export function getBaseUrl(): string {
  // Use explicit env var if set (recommended for Railway)
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }

  if (process.env.REPLIT_DEPLOYMENT === "1") {
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(",").map(d => d.trim()).filter(Boolean);
      const customDomain = domains.find(d => !d.endsWith(".replit.app") && !d.endsWith(".replit.dev"));
      if (customDomain) return `https://${customDomain}`;
      if (domains[0]) return `https://${domains[0]}`;
    }
    return "https://www.reservetmkdigital.com";
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  return "https://www.reservetmkdigital.com";
}
