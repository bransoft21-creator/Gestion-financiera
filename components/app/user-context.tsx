"use client";

import { createContext, useContext, type ReactNode } from "react";

type UserContextValue = {
  userName: string | null;
};

const UserContext = createContext<UserContextValue>({ userName: null });

export function UserProvider({
  children,
  userName,
}: {
  children: ReactNode;
  userName: string | null;
}) {
  return <UserContext.Provider value={{ userName }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
