/**
 * RoleContext - Provides user role state across the application
 * Supports developer, pm, and executive views with localStorage persistence
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type UserRole = 'developer' | 'pm' | 'executive';

interface RoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const STORAGE_KEY = 'user-role';
const DEFAULT_ROLE: UserRole = 'developer';

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

function getStoredRole(): UserRole {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'developer' || stored === 'pm' || stored === 'executive') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_ROLE;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(getStoredRole);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    try {
      localStorage.setItem(STORAGE_KEY, newRole);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  };

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const val = e.newValue as UserRole;
        if (val === 'developer' || val === 'pm' || val === 'executive') {
          setRoleState(val);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

export default RoleContext;
