import { environment } from '../environments/environment';
import { sanitizeForLogging } from './security-utils';
import { Logger } from '@nestjs/common';

const logger = new Logger('AuthManager');

interface IAuthResponse {
	user: any;
	token: string;
	refresh_token: string;
}

interface ITokenData {
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
	userId: string;
	organizationId?: string; // Add organization ID
	tenantId?: string; // Add tenant ID
}

export class AuthManager {
	private static instance: AuthManager;
	private tokenData: ITokenData | null = null;
	private apiClient: any;
	private isLoginInProgress = false;
	private isRefreshInProgress = false;
	private hasInitialized = false;

	private constructor() {}

	public static getInstance(): AuthManager {
		if (!AuthManager.instance) {
			AuthManager.instance = new AuthManager();
		}
		return AuthManager.instance;
	}

	/**
	 * Set the API client reference
	 */
	public setApiClient(apiClient: any): void {
		this.apiClient = apiClient;
	}

	/**
	 * Check if we have valid authentication
	 */
	public isAuthenticated(): boolean {
		if (!this.tokenData) {
			return false;
		}

		// Check if token is still valid (with some buffer time)
		const now = new Date();
		const expiryWithBuffer = new Date(this.tokenData.expiresAt.getTime() - 10000);

		return now < expiryWithBuffer;
	}

	/**
	 * Get the current access token
	 */
	public getAccessToken(): string | null {
		if (!this.isAuthenticated()) {
			return null;
		}
		return this.tokenData?.accessToken || null;
	}

	/**
	 * Get the current refresh token
	 */
	public getRefreshToken(): string | null {
		return this.tokenData?.refreshToken || null;
	}

	/**
	 * Get the current user ID
	 */
	public getUserId(): string | null {
		return this.tokenData?.userId || null;
	}

	/**
	 * Get the current organization ID
	 */
	public getOrganizationId(): string | null {
		return this.tokenData?.organizationId || null;
	}

	/**
	 * Get the current tenant ID
	 */
	public getTenantId(): string | null {
		return this.tokenData?.tenantId || null;
	}

	/**
	 * Get default parameters for API calls (tenant ID and organization ID)
	 */
	public getDefaultParams(): { tenantId?: string; organizationId?: string } {
		const params: { tenantId?: string; organizationId?: string } = {};

		const tenantId = this.getTenantId();
		const organizationId = this.getOrganizationId();

		if (tenantId) {
			params.tenantId = tenantId;
		}

		if (organizationId) {
			params.organizationId = organizationId;
		}

		return params;
	}

	/**
	 * Login with email and password
	 */
	public async login(email?: string, password?: string): Promise<boolean> {
		// Prevent concurrent login attempts
		if (this.isLoginInProgress) {
			if (environment.debug) {
				logger.warn('🔑 Login already in progress, skipping duplicate attempt');
			}
			return false;
		}

		this.isLoginInProgress = true;

		try {
			const credentials = {
				email: email || environment.auth.email,
				password: password || environment.auth.password
			};

			if (!credentials.email || !credentials.password) {
				if (environment.debug) {
					logger.warn('🔑 No authentication credentials provided');
				}
				return false;
			}

			if (environment.debug) {
				logger.log(`🔑 Attempting login for: ${credentials.email}`);
			}

			// Use the correct Gauzy API endpoint
			const response: IAuthResponse = await this.apiClient.post('/api/auth/login', credentials);

			if (response?.token && response?.refresh_token) {
				// Get current user's information including tenant and organization
				let organizationId: string | undefined;
				let tenantId: string | undefined;

				try {
					// Get current user data with employee relations to access organization info
					const userResponse = await this.apiClient.get('/api/user/me', {
						headers: { Authorization: `Bearer ${response.token}` },
						params: {
							relations: ['employee', 'tenant'],
							includeEmployee: true
						}
					});

					if (userResponse) {
						// Extract tenant ID directly from user data
						tenantId = userResponse.tenantId || userResponse.tenant?.id;

						// Extract organization ID from employee data if available
						if (userResponse.employee) {
							organizationId = userResponse.employee.organizationId;
						}

						// Fallback: try to get from user's organizations if employee not available
						if (!organizationId && userResponse.organizations && userResponse.organizations.length > 0) {
							organizationId = userResponse.organizations[0].id;
						}
					}
				} catch (error) {
					if (environment.debug) {
						logger.warn(
							'⚠️  Could not fetch user info for organization/tenant extraction:',
							error instanceof Error ? error.message : 'Unknown error'
						);
					}
					// Don't use environment defaults anymore since we want to rely on actual user data
				}

				this.setTokenData({
					accessToken: response.token,
					refreshToken: response.refresh_token,
					userId: response.user?.id,
					organizationId,
					tenantId,
					expiresAt: this.calculateTokenExpiry(response.token)
				});

				if (environment.debug) {
					logger.log(`✅ Login successful for user: ${response.user?.email || 'Unknown'}`);
					logger.log(`   User ID: ${response.user?.id || 'Not available'}`);
					logger.log(`   Tenant ID: ${tenantId || 'Not available'}`);
					logger.log(`   Organization ID: ${organizationId || 'Not available'}`);
				}

				return true;
			}

			if (environment.debug) {
				logger.warn('❌ Login failed - invalid response format');
			}
			return false;
		} catch (error) {
			if (environment.debug) {
				logger.error('❌ Login failed:', sanitizeForLogging(error));
			}
			return false;
		} finally {
			this.isLoginInProgress = false;
		}
	}

	/**
	 * Refresh the access token using the refresh token
	 */
	public async refreshToken(): Promise<boolean> {
		// Prevent concurrent refresh attempts
		if (this.isRefreshInProgress) {
			if (environment.debug) {
				logger.warn('🔄 Token refresh already in progress, skipping duplicate attempt');
			}
			return false;
		}

		this.isRefreshInProgress = true;

		try {
			if (!this.tokenData?.refreshToken) {
				if (environment.debug) {
					logger.warn('🔄 No refresh token available');
				}
				return false;
			}

			if (environment.debug) {
				logger.log('🔄 Refreshing access token...');
			}

			// Use the correct Gauzy API endpoint
			const response = await this.apiClient.post('/api/auth/refresh-token', {
				refresh_token: this.tokenData.refreshToken
			});

			if (response?.token) {
				// Update only the access token and expiry
				this.tokenData.accessToken = response.token;
				this.tokenData.expiresAt = this.calculateTokenExpiry(response.token);

				if (environment.debug) {
					logger.log('✅ Token refreshed successfully');
				}

				return true;
			}

			if (environment.debug) {
				logger.warn('❌ Token refresh failed - invalid response');
			}
			return false;
		} catch (error) {
			if (environment.debug) {
				logger.error('❌ Token refresh failed:', sanitizeForLogging(error));
			}
			return false;
		} finally {
			this.isRefreshInProgress = false;
		}
	}

	/**
	 * Auto-login if enabled in environment
	 */
	public async autoLogin(): Promise<boolean> {
		if (!environment.auth.autoLogin) {
			return false;
		}

		if (this.isAuthenticated()) {
			if (environment.debug) {
				logger.log('✅ Already authenticated');
			}
			return true;
		}

		return await this.login();
	}

	/**
	 * Initialize authentication once on startup
	 */
	public async initialize(): Promise<boolean> {
		if (this.hasInitialized) {
			return this.isAuthenticated();
		}

		this.hasInitialized = true;

		if (environment.auth.autoLogin) {
			return await this.autoLogin();
		}

		return false;
	}

	/**
	 * Ensure we have a valid token, refresh if necessary
	 */
	public async ensureValidToken(): Promise<boolean> {
		// If we have a valid token, return true
		if (this.isAuthenticated()) {
			return true;
		}

		// If we have a refresh token, try to refresh
		if (this.tokenData?.refreshToken && !this.isRefreshInProgress) {
			const refreshed = await this.refreshToken();
			if (refreshed) {
				return true;
			}
		}

		// Don't attempt auto-login in ensureValidToken to prevent loops
		// Auto-login should only happen during initialization
		return false;
	}

	/**
	 * Logout and clear stored tokens
	 */
	public async logout(): Promise<void> {
		try {
			if (this.tokenData?.accessToken && this.apiClient) {
				// Call logout endpoint to invalidate refresh token on server
				await this.apiClient.get('/api/auth/logout');
			}
		} catch (error) {
			// Ignore logout errors, we're clearing local data anyway
			if (environment.debug) {
				logger.warn('⚠️  Logout endpoint failed, clearing local data anyway');
			}
		} finally {
			this.clearTokenData();
			this.hasInitialized = false; // Allow re-initialization after logout
			if (environment.debug) {
				logger.log('🔑 Logged out successfully');
			}
		}
	}

	/**
	 * Set token data
	 */
	private setTokenData(tokenData: ITokenData): void {
		this.tokenData = tokenData;
	}

	/**
	 * Clear token data
	 */
	private clearTokenData(): void {
		this.tokenData = null;
	}

	/**
	 * Calculate token expiry date from JWT token
	 */
	private calculateTokenExpiry(token: string): Date {
		try {
			// JWT tokens are base64 encoded, decode the payload
			const base64Url = token.split('.')[1];
			const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
			const jsonPayload = decodeURIComponent(
				atob(base64)
				.split('')
				.map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
				.join('')
			);
			const decoded = JSON.parse(jsonPayload);

			if (decoded.exp) {
				return new Date(decoded.exp * 1000); // Convert Unix timestamp to Date
			}
		} catch (error) {
			if (environment.debug) {
				logger.warn('⚠️  Could not decode JWT token expiry, using default');
			}
		}

		// Default to 1 hour from now if we can't decode
		return new Date(Date.now() + 3600000);
	}

	/**
	 * Get authentication status details
	 */
	public getAuthStatus() {
		return {
			isAuthenticated: this.isAuthenticated(),
			hasToken: !!this.tokenData?.accessToken,
			hasRefreshToken: !!this.tokenData?.refreshToken,
			userId: this.getUserId(),
			organizationId: this.getOrganizationId(),
			tenantId: this.getTenantId(),
			tokenExpiresAt: this.tokenData?.expiresAt,
			autoLoginEnabled: environment.auth.autoLogin,
			hasInitialized: this.hasInitialized,
			isLoginInProgress: this.isLoginInProgress,
			isRefreshInProgress: this.isRefreshInProgress
		};
	}
}

// Export singleton instance
export const authManager = AuthManager.getInstance();
