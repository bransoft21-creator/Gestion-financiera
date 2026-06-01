"use client";

import { createContext, useContext, type ReactNode } from "react";

type UserContextValue = {
  userName: string | null;
  copilotEnabled: boolean;
};

const UserContext = createContext<UserContextValue>({ userName: null, copilotEnabled: false });

export function UserProvider({
  children,
  userName,
  copilotEnabled,
}: {
  children: ReactNode;
  userName: string | null;
  copilotEnabled?: boolean;
}) {
  return (
    <UserContext.Provider value={{ userName, copilotEnabled: copilotEnabled ?? false }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
