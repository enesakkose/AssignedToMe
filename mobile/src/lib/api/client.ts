import { env } from "@/config/env";
import { API_METHOD, type ApiMethod } from "@/lib/api/api-method";
import { HTTP_STATUS } from "@/lib/api/http-status";
import { AppError } from "@/lib/errors";
import { secureStorage } from "@/lib/storage/secure-storage";
import axios, { AxiosError, type AxiosRequestConfig } from "axios";

type ApiRequestOptions<TBody> = {
  body?: TBody;
  headers?: AxiosRequestConfig["headers"];
  method?: ApiMethod;
  token?: string | null;
};

async function resolveToken(token?: string | null) {
  if (token !== undefined) {
    return token;
  }

  return secureStorage.getItem("auth.accessToken");
}

export const axiosClient = axios.create({
  baseURL: env.apiUrl,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return data.message;
  }

  return fallback;
}

function normalizeApiError(error: unknown): AppError {
  if (!axios.isAxiosError(error)) {
    return AppError.fromUnknown(error);
  }

  const axiosError = error as AxiosError;

  if (!axiosError.response) {
    return new AppError("Network request failed.", "network", undefined, axiosError);
  }

  const { data, status } = axiosError.response;

  return new AppError(
    getErrorMessage(data, `Request failed with status ${status}.`),
    status === HTTP_STATUS.unauthorized ? "unauthorized" : "api",
    status,
    data,
  );
}

export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
) {
  const token = await resolveToken(options.token);

  try {
    const response = await axiosClient.request<TResponse>({
      data: options.body,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      method: options.method ?? API_METHOD.get,
      url: path,
    });

    return response.data;
  } catch (error: unknown) {
    throw normalizeApiError(error);
  }
}

export const apiClient = {
  delete: <TResponse>(path: string, options?: ApiRequestOptions<never>) =>
    apiRequest<TResponse>(path, { ...options, method: API_METHOD.delete }),
  get: <TResponse>(path: string, options?: ApiRequestOptions<never>) =>
    apiRequest<TResponse>(path, { ...options, method: API_METHOD.get }),
  patch: <TResponse, TBody>(path: string, body: TBody, options?: ApiRequestOptions<TBody>) =>
    apiRequest<TResponse, TBody>(path, { ...options, body, method: API_METHOD.patch }),
  post: <TResponse, TBody>(path: string, body: TBody, options?: ApiRequestOptions<TBody>) =>
    apiRequest<TResponse, TBody>(path, { ...options, body, method: API_METHOD.post }),
  put: <TResponse, TBody>(path: string, body: TBody, options?: ApiRequestOptions<TBody>) =>
    apiRequest<TResponse, TBody>(path, { ...options, body, method: API_METHOD.put }),
};
