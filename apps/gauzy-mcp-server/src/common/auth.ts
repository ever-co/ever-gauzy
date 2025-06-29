import { apiClient } from "./api-client.js";

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
}

export async function authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>("/api/auth/login", credentials);
    
    // Set the token in the API client for subsequent requests
    if (response.token) {
      apiClient.setToken(response.token);
    }
    
    return response;
  } catch (error) {
    console.error("Authentication failed:", error);
    throw new Error("Authentication failed");
  }
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>("/api/auth/refresh-token", { refreshToken });
    
    // Set the new token in the API client
    if (response.token) {
      apiClient.setToken(response.token);
    }
    
    return response;
  } catch (error) {
    console.error("Token refresh failed:", error);
    throw new Error("Token refresh failed");
  }
}