export interface AdminSession {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export const requireAdminSession = async (): Promise<AdminSession | null> => {
  // Placeholder to be replaced with real admin auth when wired.
  return {
    user: {
      id: "admin",
      role: "admin"
    }
  };
};

