import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Logger } from '@nestjs/common';
import { environment } from '../environments/environment';
import { authManager } from './auth-manager';
import { sanitizeErrorMessage } from './error-utils';

const logger = new Logger('ApiClient');

/** A request sent again after its 401 had GAUZY_API_TOKEN exchanged again */
interface IApiTokenRetryConfig extends InternalAxiosRequestConfig {
	isRetryAfterApiTokenExchange?: boolean;
}

export class GauzyApiClient {
	private static instance: GauzyApiClient;
	private client: AxiosInstance;

	private constructor() {
		// Get configuration from environment variables
		const baseUrl = this.getBaseUrl();
		const timeout = this.getTimeout();

		this.client = axios.create({
			baseURL: baseUrl,
			timeout,
			headers: {
				'Content-Type': 'application/json'
			}
		});

		// Set reference to API client in auth manager
		authManager.setApiClient(this);

		// Add request interceptor to include auth token and handle authentication
		this.client.interceptors.request.use(async (config) => {
			// Skip if Authorization header already set by caller
			if (config.headers.Authorization) {
				return config;
			}

			// Skip authentication for auth endpoints
			const isAuthEndpoint = config.url?.includes('/api/auth/') || config.url?.includes('/auth/');

			if (!isAuthEndpoint) {
				const authStatus = authManager.getAuthStatus();

				if (!authStatus.isLoginInProgress && !authStatus.isRefreshInProgress) {
					// Only ensure valid token for non-auth endpoints when not already authenticating
					const hasValidToken = await authManager.ensureValidToken();

					if (hasValidToken) {
						const token = authManager.getAccessToken();
						if (token) {
							config.headers.Authorization = `Bearer ${token}`;
						}
					}
				} else {
					// If login/refresh is in progress, just add the current token if available
					const token = authManager.getAccessToken();
					if (token) {
						config.headers.Authorization = `Bearer ${token}`;
					}
				}
			}

			return config;
		});

		// Add response interceptor for error handling
		this.client.interceptors.response.use(
			(response) => response,
			async (error: AxiosError) => {
				if (this.isDebug()) {
					const errorDetails = {
						url: error.config?.url,
						method: error.config?.method?.toUpperCase(),
						status: error.response?.status,
						message: sanitizeErrorMessage(error),
						response: error.response?.data ? sanitizeErrorMessage(error.response.data) : undefined
					};
					logger.debug('🔴 API Client Error Details:\n' + JSON.stringify(errorDetails, null, 2));
				}

				// Handle 401 Unauthorized errors by attempting token refresh
				if (
					error.response?.status === 401 &&
					!error.config?.url?.includes('/api/auth/') &&
					!error.config?.url?.includes('/auth/')
				) {
					const config = error.config as IApiTokenRetryConfig | undefined;
					// A login from GAUZY_API_TOKEN is exchanged again once per request: the answer to the retry stands
					if (config?.isRetryAfterApiTokenExchange) {
						return Promise.reject(error);
					}

					if (environment.debug) {
						logger.warn('🔄 Received 401, attempting token refresh...');
					}

					const refreshed = await authManager.refreshToken();
					if (refreshed && error.config) {
						// Retry the original request with the new token
						const token = authManager.getAccessToken();
						if (token) {
							error.config.headers.Authorization = `Bearer ${token}`;
							if (authManager.isApiTokenLogin()) {
								config.isRetryAfterApiTokenExchange = true;
							}
							return this.client.request(error.config);
						}
					}

					this.explainApiTokenFailure(error);
				}

				return Promise.reject(error);
			}
		);

		// Initialize authentication if auto-login is enabled
		if (environment.auth.autoLogin) {
			this.initializeAuthentication();
		}

		// Only log initialization in debug mode and to stderr
		if (this.isDebug()) {
			logger.log('🔧 API Client initialized');
			logger.log(`   Base URL: ${baseUrl}`);
			logger.log(`   Timeout: ${timeout}ms`);
			logger.log(`   Auto Login: ${environment.auth.autoLogin ? '✓ Enabled' : '❌ Disabled'}`);
		}
	}

	/**
	 * Initialize authentication on startup if auto-login is enabled
	 */
	private async initializeAuthentication(): Promise<void> {
		try {
			await authManager.initialize();
		} catch (error) {
			if (this.isDebug()) {
				logger.error(
					'❌ Auto-login failed:',
					error instanceof Error ? sanitizeErrorMessage(error) : 'Unknown error'
				);
			}
		}
	}

	/**
	 * A request refused because GAUZY_API_TOKEN gives no session says why, in place of a bare 401: the tool that made
	 * it answers with that message
	 */
	private explainApiTokenFailure(error: AxiosError): void {
		const apiTokenError = authManager.getApiTokenError();
		if (apiTokenError) {
			error.message = apiTokenError;
		}
	}

	public static getInstance(): GauzyApiClient {
		if (!GauzyApiClient.instance) {
			GauzyApiClient.instance = new GauzyApiClient();
		}
		return GauzyApiClient.instance;
	}

	public getBaseUrl(): string {
		return environment.baseUrl;
	}

	public getTimeout(): number {
		return environment.apiTimeout;
	}

	public isDebug(): boolean {
		return environment.debug;
	}

	/**
	 * Login with email and password
	 */
	public async login(email?: string, password?: string): Promise<{ success: boolean; error?: string }> {
		try {
			const success = await authManager.login(email, password);
			if (success || email || password) {
				return { success };
			}
			// Signed in with the configured credentials: when they hold GAUZY_API_TOKEN, say why it gave no session
			const apiTokenError = authManager.getApiTokenError();
			if (apiTokenError) {
				return { success, error: apiTokenError };
			}
			return { success };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Login failed';
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Logout and clear authentication
	 */
	public async logout(): Promise<void> {
		await authManager.logout();
	}

	/**
	 * Get authentication status
	 */
	public getAuthStatus() {
		return authManager.getAuthStatus();
	}

	/**
	 * Configure the API client
	 */
	public configure(config: { baseUrl?: string; timeout?: number }): void {
		if (config.baseUrl) {
			this.client.defaults.baseURL = config.baseUrl;
			if (this.isDebug()) {
				logger.log(`🔧 Base URL updated to: ${config.baseUrl}`);
			}
		}
		if (config.timeout) {
			this.client.defaults.timeout = config.timeout;
			if (this.isDebug()) {
				logger.log(`🔧 Timeout updated to: ${config.timeout}ms`);
			}
		}
	}

	public async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
		try {
			const response = await this.client.get<T>(path, config);
			return response.data;
		} catch (error) {
			this.logError('GET', path, error);
			throw error;
		}
	}

	public async post<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
		try {
			const response = await this.client.post<T>(path, data, config);
			return response.data;
		} catch (error) {
			this.logError('POST', path, error);
			throw error;
		}
	}

	public async put<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
		try {
			const response = await this.client.put<T>(path, data, config);
			return response.data;
		} catch (error) {
			this.logError('PUT', path, error);
			throw error;
		}
	}

	public async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
		try {
			const response = await this.client.delete<T>(path, config);
			return response.data;
		} catch (error) {
			this.logError('DELETE', path, error);
			throw error;
		}
	}

	public async patch<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
		try {
			const response = await this.client.patch<T>(path, data, config);
			return response.data;
		} catch (error) {
			this.logError('PATCH', path, error);
			throw error;
		}
	}

	private logError(method: string, path: string, error: any): void {
		if (this.isDebug()) {
			logger.error(
				`🔴 ${method} ${path} failed`,
				error instanceof Error ? sanitizeErrorMessage(error.stack) : sanitizeErrorMessage(error)
			);
		}
	}

	/**
	 * Test the connection to the Gauzy API with comprehensive diagnostics
	 */
	public async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
		try {
			// First, test basic connectivity with health check endpoints
			const healthEndpoints = ['/api/health', '/api', '/health', '/', '/api/public/health'];
			let lastError: any = null;
			let healthCheckSuccess = false;

			for (const endpoint of healthEndpoints) {
				try {
					const response = await this.get(endpoint);
					healthCheckSuccess = true;
					break;
				} catch (error) {
					lastError = error;
				}
			}

			if (!healthCheckSuccess) {
				const errorMessage = this.getConnectionErrorMessage(lastError);
				return {
					success: false,
					error: errorMessage,
					details: {
						baseUrl: this.getBaseUrl(),
						authStatus: this.getAuthStatus(),
						lastError: lastError instanceof Error ? lastError.message : 'Unknown error',
						triedEndpoints: healthEndpoints
					}
				};
			}

			// If health check passed, test authentication
			const authStatus = this.getAuthStatus();

			if (environment.auth.autoLogin && !authStatus.isAuthenticated && !authStatus.isLoginInProgress) {
				// Try to authenticate
				const loginResult = await this.login();
				if (!loginResult.success) {
					return {
						success: false,
						error: `Health check passed but authentication failed: ${loginResult.error}`,
						details: {
							baseUrl: this.getBaseUrl(),
							authStatus: this.getAuthStatus(),
							healthCheckPassed: true
						}
					};
				}
			}

			// Test an authenticated endpoint if we have auth
			if (authStatus.isAuthenticated) {
				try {
					await this.get('/api/user/me');
				} catch (error) {
					// Authenticated endpoint test failed, but basic connectivity works
					if (this.isDebug()) {
						logger.warn(
							'Authenticated endpoint test failed:',
							error instanceof Error ? sanitizeErrorMessage(error) : 'Unknown error'
						);
					}
				}
			}

			return {
				success: true,
				details: {
					baseUrl: this.getBaseUrl(),
					authStatus: this.getAuthStatus(),
					healthCheckPassed: true,
					authenticatedTestPassed: authStatus.isAuthenticated
				}
			};
		} catch (error) {
			const errorMessage = this.getConnectionErrorMessage(error);

			return {
				success: false,
				error: errorMessage,
				details: {
					baseUrl: this.getBaseUrl(),
					authStatus: this.getAuthStatus(),
					error: error instanceof Error ? error.message : 'Unknown error'
				}
			};
		}
	}

	private getConnectionErrorMessage(error: any): string {
		if (error?.code === 'ECONNREFUSED') {
			return `Connection refused - is the Gauzy API server running on ${this.getBaseUrl()}?`;
		}
		if (error?.code === 'ENOTFOUND') {
			return `Host not found - please check the API_BASE_URL: ${this.getBaseUrl()}`;
		}
		if (error?.code === 'ETIMEDOUT') {
			return `Connection timeout - the server may be slow or unreachable`;
		}
		if (error?.response?.status === 404) {
			return `API endpoint not found - server is running but health check endpoint is missing`;
		}
		if (error?.response?.status === 401) {
			return `Authentication failed - check your credentials or login manually`;
		}
		if (error?.response?.status === 403) {
			return `Access forbidden - insufficient permissions`;
		}
		if (error?.response?.status >= 500) {
			return `Server error (${error.response.status}) - the Gauzy API server has an internal error`;
		}

		return error instanceof Error ? error.message : 'Unknown connection error';
	}
}

// Export singleton instance
export const apiClient = GauzyApiClient.getInstance();
