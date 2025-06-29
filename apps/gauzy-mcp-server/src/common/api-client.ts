import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export class GauzyApiClient {
  private static instance: GauzyApiClient;
  private client: AxiosInstance;
  private baseUrl: string;
  private token: string | null = null;

  private constructor() {
    this.baseUrl = process.env.GAUZY_API_URL || "https://api.gauzy.co";
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  public static getInstance(): GauzyApiClient {
    if (!GauzyApiClient.instance) {
      GauzyApiClient.instance = new GauzyApiClient();
    }
    return GauzyApiClient.instance;
  }

  public setToken(token: string): void {
    this.token = token;
  }


  public async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(path, config);
    return response.data;
  }


  public async post<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(path, data, config);
    return response.data;
  }

  public async put<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(path, data, config);
    return response.data;
  }

  public async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(path, config);
    return response.data;
  }
}

export const apiClient = GauzyApiClient.getInstance();
