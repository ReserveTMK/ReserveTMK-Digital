export function getBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT === "1") {
    if (process.env.REPLIT_DOMAINS) {
      const primaryDomain = process.env.REPLIT_DOMAINS.split(",")[0].trim();
      if (primaryDomain) return `https://${primaryDomain}`;
    }
    return "https://reservetmkdigital.com";
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  return "https://reservetmkdigital.com";
}
