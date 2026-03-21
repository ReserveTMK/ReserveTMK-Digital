export { setupAuth, isAuthenticated, isAdmin, getSession } from "./clerkAuth";

// Stub for compatibility — Clerk handles auth routes inside setupAuth
export function registerAuthRoutes() {}
export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";
