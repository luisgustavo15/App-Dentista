// API client - uses EXPO_PUBLIC_BACKEND_URL and the stored auth token.
import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
export const AUTH_TOKEN_KEY = "auth_token";

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken() {
  return inMemoryToken;
}

export async function loadStoredToken(): Promise<string | null> {
  const t = await storage.secureGet<string | null>(AUTH_TOKEN_KEY, null);
  inMemoryToken = (t as string | null) ?? null;
  return inMemoryToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;

  const resp = await fetch(`${BASE_URL}/api${path}`, { ...init, headers });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const j = await resp.json();
      detail = j.detail ?? JSON.stringify(j);
    } catch {}
    const message = typeof detail === "string" ? detail : "Verifique os dados informados";
    const err = new Error(message) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  if (resp.status === 204) return undefined as unknown as T;
  return (await resp.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  role: "patient" | "admin";
  phone?: string | null;
  birth_date?: string | null;
};

export type Service = {
  id: string;
  name: string;
  description: string;
  duration_min: number;
  price: number;
  icon: string;
};

export type Dentist = {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  photo: string;
  cro: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  description: string;
  before_image: string;
  after_image: string;
  service_name: string;
};

export type Appointment = {
  id: string;
  user_id: string;
  patient_name: string;
  patient_email: string;
  service_id: string;
  service_name: string;
  dentist_id: string;
  dentist_name: string;
  date: string;
  time: string;
  notes: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  created_at: string;
};

export type ClinicInfo = {
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  lat: number;
  lng: number;
};
