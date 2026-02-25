import { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@shared/schema";
import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from "firebase/auth";
import { auth, signInWithGoogle } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referralCode?: string;
  middleName?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  driverLicenseNumber?: string;
  medicalCondition?: string;
  ssn?: string;
  hasMedicare?: boolean;
  isVeteran?: boolean;
  smsConsent?: boolean;
  emailConsent?: boolean;
  chargeUnderstanding?: boolean;
  patientAuthorization?: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setUser(data.user || data);
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const getIdToken = async () => {
    return firebaseUser ? await firebaseUser.getIdToken() : null;
  };

  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Login failed');
      }
      const data = await response.json();
      setUser(data.user || data);
      return data.user || data;
    } catch (error: any) {
      if (error?.message?.includes?.('Login failed')) throw error;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Login failed');
        }
        const data = await response.json();
        if (data.customToken) {
          try {
            await signInWithCustomToken(auth, data.customToken);
          } catch (tokenErr) {
            console.error("Custom token sign-in failed:", tokenErr);
          }
        }
        setUser(data.user);
        return data.user;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<User> => {
    setLoading(true);
    try {
      const { idToken } = await signInWithGoogle();
      const response = await apiRequest("POST", "/api/auth/firebase", { idToken });
      const data = await response.json();
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<User> => {
    setLoading(true);
    try {
      let firebaseUid: string | undefined;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        firebaseUid = userCredential.user.uid;
      } catch (fbError: any) {
        console.warn("Firebase Auth registration skipped:", fbError.message);
      }

      const response = await apiRequest("POST", "/api/auth/register", {
        ...data,
        firebaseUid,
      });
      const result = await response.json();
      setUser(result.user);
      return result.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      try { await signOut(auth); } catch {}
    } finally {
      setUser(null);
      setFirebaseUser(null);
    }
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user || data);
        }
      } catch {}
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    isLoading: loading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    register,
    logout,
    getIdToken,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
