export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "https://www.winunio.com";

export const ANDROID_CLIENT_HEADER = "x-winunio-client";
export const ANDROID_CLIENT_VALUE = "android";

export type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      [ANDROID_CLIENT_HEADER]: ANDROID_CLIENT_VALUE,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  const data = (await res.json()) as T & ApiErrorBody;
  if (!res.ok) {
    throw new ApiRequestError(
      data.error?.message ?? "Kérés sikertelen",
      res.status,
      data.error?.code,
    );
  }
  return data;
}

export type LoginResponse = {
  user: { id: string; email: string };
  access_token: string;
};

export async function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMe(token: string) {
  return apiFetch<{ user: { id: string; email: string } }>("/api/v1/auth/me", {
    token,
  });
}
