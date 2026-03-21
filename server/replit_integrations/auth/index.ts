export { setupAuth, isAuthenticated, isAdmin, getSession } from "./clerkAuth";
export { authStorage, type IAuthStorage } from "./storage";

// Stub for compatibility — Clerk handles auth routes inside setupAuth
export function registerAuthRoutes() {}
