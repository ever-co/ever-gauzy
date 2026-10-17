import { environment } from '../environments/environment';
import { sanitizeForLogging } from './error-utils';
import { getAuthKey } from './auth-context';
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
	source?: 'auto-login' | 'manual';
}

interface IAuthState {
	tokenData: ITokenData | null;
	isLoginInProgress: boolean;
	isRefreshInProgress: boolean;
}

const createAuthState = (): IAuthState => ({ tokenData: null, isLoginInProgress: false, isRefreshInProgress: false });

export class AuthManager {
	private static instance: AuthManager;
	// Process-wide login: the stdio login, or on HTTP/WebSocket the GAUZY_AUTO_LOGIN account callers may fall back to
	private readonly processState: IAuthState = createAuthState();
	// Logins of HTTP/WebSocket sessions and OAuth subjects, by auth key
	private readonly keyedStates = new Map<string, IAuthState>();
	private apiClient: any;
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
		const tokenData = this.currentTokenData();
		if (!tokenData) {
			return false;
		}

		// Check if token is still valid (with some buffer time)
		const now = new Date();
		const expiryWithBuffer = new Date(tokenData.expiresAt.getTime() - 10000);

		return now < expiryWithBuffer;
	}

	/**
	 * Get the current access token
	 */
	public getAccessToken(): string | null {
		if (!this.isAuthenticated()) {
			return null;
		}
		return this.currentTokenData()?.accessToken || null;
	}

	/**
	 * Get the current refresh token
	 */
	public getRefreshToken(): string | null {
		return this.currentTokenData()?.refreshToken || null;
	}

	/**
	 * Get the current user ID
	 */
	public getUserId(): string | null {
		return this.currentTokenData()?.userId || null;
	}

	/**
	 * Get the current organization ID
	 */
	public getOrganizationId(): string | null {
		return this.currentTokenData()?.organizationId || null;
	}

	/**
	 * Get the current tenant ID
	 */
	public getTenantId(): string | null {
		return this.currentTokenData()?.tenantId || null;
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
		const authKey = getAuthKey();
		const state = authKey === undefined ? this.processState : (this.keyedStates.get(authKey) ?? createAuthState());

		// Prevent concurrent login attempts
		if (state.isLoginInProgress) {
			if (environment.debug) {
				logger.warn('🔑 Login already in progress, skipping duplicate attempt');
			}
			return false;
		}

		state.isLoginInProgress = true;

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

				this.setTokenData(
					state,
					{
						accessToken: response.token,
						refreshToken: response.refresh_token,
						userId: response.user?.id,
						organizationId,
						tenantId,
						expiresAt: this.calculateTokenExpiry(response.token),
						source: email || password ? 'manual' : 'auto-login'
					},
					authKey
				);

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
			state.isLoginInProgress = false;
		}
	}

	/**
	 * Refresh the access token using the refresh token
	 */
	public async refreshToken(): Promise<boolean> {
		const state = this.resolveState() ?? createAuthState();

		// Prevent concurrent refresh attempts
		if (state.isRefreshInProgress) {
			if (environment.debug) {
				logger.warn('🔄 Token refresh already in progress, skipping duplicate attempt');
			}
			return false;
		}

		state.isRefreshInProgress = true;

		try {
			if (!state.tokenData?.refreshToken) {
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
				refresh_token: state.tokenData.refreshToken
			});

			if (response?.token) {
				// Update only the access token and expiry
				state.tokenData.accessToken = response.token;
				state.tokenData.expiresAt = this.calculateTokenExpiry(response.token);

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
			state.isRefreshInProgress = false;
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
		const state = this.resolveState();
		if (state?.tokenData?.refreshToken && !state.isRefreshInProgress) {
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
		const authKey = getAuthKey();
		// A keyed caller only logs out its own login, never the shared auto-login account it may fall back to
		const ownTokenData =
			authKey === undefined ? this.processState.tokenData : this.keyedStates.get(authKey)?.tokenData;

		try {
			if (ownTokenData?.accessToken && this.apiClient) {
				// Call logout endpoint to invalidate refresh token on server
				await this.apiClient.get('/api/auth/logout');
			}
		} catch (error) {
			// Ignore logout errors, we're clearing local data anyway
			if (environment.debug) {
				logger.warn('⚠️  Logout endpoint failed, clearing local data anyway');
			}
		} finally {
			this.clearTokenData(authKey);
			if (authKey === undefined) {
				this.hasInitialized = false; // Allow re-initialization after logout
			}
			if (environment.debug) {
				logger.log('🔑 Logged out successfully');
			}
		}
	}

	/**
	 * Forget the login kept for an auth key (called when its session or connection goes away).
	 * When that key had a login of its own, `boundKeys` (connections still bound to it) get an empty one,
	 * so they fail as unauthenticated instead of silently running as the auto-login account.
	 */
	public clearKey(authKey: string, boundKeys: Iterable<string> = []): void {
		if (this.keyedStates.has(authKey)) {
			for (const boundKey of boundKeys) {
				if (!this.keyedStates.has(boundKey)) {
					this.keyedStates.set(boundKey, createAuthState());
				}
			}
		}
		this.keyedStates.delete(authKey);
	}

	/**
	 * Whether the process-wide login is the account configured through GAUZY_AUTO_LOGIN,
	 * the only one that may be shared with callers that have not logged in themselves
	 */
	public isSharedAutoLoginIdentity(): boolean {
		return this.processState.tokenData?.source === 'auto-login';
	}

	/**
	 * Give an auth key a copy of the current caller's login (used when a session is created from it)
	 */
	public copyLoginToKey(authKey: string): void {
		const tokenData = this.currentTokenData();
		if (tokenData) {
			this.keyedStates.set(authKey, { ...createAuthState(), tokenData: { ...tokenData } });
		}
	}

	/**
	 * Login state of the current caller. Without an auth key this is the process-wide login, as before.
	 * A keyed caller with no login of its own falls back to the process-wide login only when it is the auto-login account.
	 */
	private resolveState(): IAuthState | null {
		const authKey = getAuthKey();
		if (authKey === undefined) {
			return this.processState;
		}
		return this.keyedStates.get(authKey) ?? (this.isSharedAutoLoginIdentity() ? this.processState : null);
	}

	private currentTokenData(): ITokenData | null {
		return this.resolveState()?.tokenData ?? null;
	}

	/**
	 * Set token data
	 */
	private setTokenData(state: IAuthState, tokenData: ITokenData, authKey?: string): void {
		state.tokenData = tokenData;
		if (authKey !== undefined) {
			this.keyedStates.set(authKey, state);
		}
	}

	/**
	 * Clear token data
	 */
	private clearTokenData(authKey?: string): void {
		if (authKey === undefined) {
			this.processState.tokenData = null;
		} else {
			// Keep an empty entry so the caller stays logged out instead of falling back to the auto-login account
			this.keyedStates.set(authKey, createAuthState());
		}
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
		const state = this.resolveState();
		return {
			isAuthenticated: this.isAuthenticated(),
			hasToken: !!state?.tokenData?.accessToken,
			hasRefreshToken: !!state?.tokenData?.refreshToken,
			userId: this.getUserId(),
			organizationId: this.getOrganizationId(),
			tenantId: this.getTenantId(),
			tokenExpiresAt: state?.tokenData?.expiresAt,
			autoLoginEnabled: environment.auth.autoLogin,
			hasInitialized: this.hasInitialized,
			isLoginInProgress: !!state?.isLoginInProgress,
			isRefreshInProgress: !!state?.isRefreshInProgress
		};
	}
}

// Export singleton instance
export const authManager = AuthManager.getInstance();
