export function getBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT === "1") {
    if (process.env.REPLIT_DOMAINS) {
      const primaryDomain = process.env.REPLIT_DOMAINS.split(",")[0].trim();
      if (primaryDomain) return `https://${primaryDomain}`;
    }
    return "https://mentor-metrics-log.replit.app";
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  return "https://mentor-metrics-log.replit.app";
}
