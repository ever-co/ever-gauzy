/**
 * OAuth 2.0 Client Management
 *
 * Manages OAuth 2.0 client registration and validation for MCP authorization
 */

import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { SecurityLogger } from '../utils/security-logger';
import { ClientRegistrationResponse } from '../interfaces';

export interface OAuth2Client {
	clientId: string;
	clientSecret?: string;
	clientSecretHash?: string;
	clientName: string;
	clientType: 'confidential' | 'public';
	redirectUris: string[];
	grantTypes: string[];
	responseTypes: string[];
	scopes: string[];
	logoUri?: string;
	clientUri?: string;
	policyUri?: string;
	tosUri?: string;
	createdAt: Date;
	updatedAt: Date;
	isActive: boolean;
	metadata?: Record<string, any>;
}

export interface ClientRegistrationRequest {
	client_name: string;
	client_type?: 'confidential' | 'public';
	redirect_uris: string[];
	grant_types?: string[];
	response_types?: string[];
	scope?: string;
	logo_uri?: string;
	client_uri?: string;
	policy_uri?: string;
	tos_uri?: string;
	metadata?: Record<string, any>;
}


export class OAuth2ClientManager {
	private clients = new Map<string, OAuth2Client>();
	private securityLogger: SecurityLogger;

	// Default supported scopes for MCP
	private readonly DEFAULT_SCOPES = ['mcp.read', 'mcp.write', 'mcp.admin'];
	private readonly DEFAULT_GRANT_TYPES = ['authorization_code', 'refresh_token'];
	private readonly DEFAULT_RESPONSE_TYPES = ['code'];

	constructor() {
		this.securityLogger = new SecurityLogger();
		this.initializeDefaultClients();
	}

	/**
	 * Initialize default clients for common MCP integrations
	 */
	private initializeDefaultClients() {

		//Test Client
		void this.registerClient({
			client_name: 'Test Client',
			client_type: 'public',
			redirect_uris: [
				'http://localhost:3001/callback',
			],
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			scope: 'mcp.read mcp.write',
			metadata: {
				integration_type: 'test',
				auto_created: true
			}
		}, 'test-client').catch((err) => this.securityLogger.error('Default client init failed:', err as Error));

		// ChatGPT default client
		void this.registerClient({
			client_name: 'ChatGPT MCP Integration',
			client_type: 'public',
			redirect_uris: [
				'https://chatgpt.com/oauth/callback',
				'https://chat.openai.com/oauth/callback'
			],
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			scope: 'mcp.read mcp.write',
			logo_uri: 'https://openai.com/favicon.ico',
			client_uri: 'https://chat.openai.com',
			metadata: {
				integration_type: 'chatgpt',
				auto_created: true
			}
		}, 'chatgpt-mcp-client').catch((err) => this.securityLogger.error('Default client init failed:', err as Error));

		// Claude Desktop default client
		void this.registerClient({
			client_name: 'Claude MCP Integration',
			client_type: 'public',
			redirect_uris: [
				'http://localhost:*',
				'https://claude.ai/oauth/callback'
			],
			grant_types: ['authorization_code'],
			response_types: ['code'],
			scope: 'mcp.read mcp.write',
			logo_uri: 'https://claude.ai/favicon.ico',
			client_uri: 'https://claude.ai',
			metadata: {
				integration_type: 'claude',
				auto_created: true
			}
		}, 'claude-mcp-client').catch((err) => this.securityLogger.error('Default client init failed:', err as Error));

		this.securityLogger.log('Default OAuth 2.0 clients initialized');
	}

	/**
	 * Register a new OAuth 2.0 client
	 */
	async registerClient(
		request: ClientRegistrationRequest,
		customClientId?: string
	): Promise<ClientRegistrationResponse> {
		try {
			// Validate request
			this.validateClientRegistration(request);

			const clientId = customClientId || this.generateClientId();
			if (this.clients.has(clientId)) {
				throw new Error(`client_id already exists: ${clientId}`);
			}
			const clientType = request.client_type || 'confidential';
			const grantTypes = request.grant_types || this.DEFAULT_GRANT_TYPES;
			const responseTypes = request.response_types || this.DEFAULT_RESPONSE_TYPES;
			const scopes = this.parseAndValidateScopes(request.scope);

			// Generate client secret for confidential clients
			let clientSecret: string | undefined;
			let clientSecretHash: string | undefined;

			if (clientType === 'confidential') {
				clientSecret = this.generateClientSecret();
				clientSecretHash = await bcrypt.hash(clientSecret, 12);
			}

			// Validate redirect URIs
			this.validateRedirectUris(request.redirect_uris, clientType);

			const client: OAuth2Client = {
				clientId,
				clientSecretHash,
				clientName: request.client_name,
				clientType,
				redirectUris: request.redirect_uris,
				grantTypes,
				responseTypes,
				scopes,
				logoUri: request.logo_uri,
				clientUri: request.client_uri,
				policyUri: request.policy_uri,
				tosUri: request.tos_uri,
				createdAt: new Date(),
				updatedAt: new Date(),
				isActive: true,
				metadata: request.metadata
			};

			// Store client
			this.clients.set(clientId, client);

			this.securityLogger.log(`OAuth 2.0 client registered: ${clientId} (${request.client_name})`);

			// Return registration response based on client type
			const baseResponse = {
				client_id: clientId,
				client_name: client.clientName,
				redirect_uris: client.redirectUris,
				grant_types: client.grantTypes,
				response_types: client.responseTypes,
				scope: client.scopes.join(' '),
				logo_uri: client.logoUri,
				client_uri: client.clientUri,
				policy_uri: client.policyUri,
				tos_uri: client.tosUri,
				client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000)
			};

			const response: ClientRegistrationResponse = clientType === 'confidential'
				? {
					...baseResponse,
					client_type: 'confidential',
					client_secret: clientSecret!,
					client_secret_expires_at: 0 // 0 = never expires
				}
				: {
					...baseResponse,
					client_type: 'public',
					client_secret: undefined,
					client_secret_expires_at: undefined
				};

			return response;

		} catch (error: any) {
			this.securityLogger.error('Client registration failed:', error);
			throw new Error(`Client registration failed: ${error.message}`);
		}
	}

	/**
	 * Validate client credentials
	 */
	async validateClient(clientId: string, clientSecret?: string): Promise<OAuth2Client | null> {
		const client = this.clients.get(clientId);

		if (!client || !client.isActive) {
			return null;
		}

		// Public clients don't require secret validation
		if (client.clientType === 'public') {
			return client;
		}

		// Confidential clients must provide valid secret
		if (!clientSecret || !client.clientSecretHash) {
			return null;
		}

		const isValidSecret = await bcrypt.compare(clientSecret, client.clientSecretHash);
		return isValidSecret ? client : null;
	}

	/**
	 * Get client by ID
	 */
	getClient(clientId: string): OAuth2Client | null {
		return this.clients.get(clientId) || null;
	}

	/**
	 * Validate redirect URI for client
	 */
	isValidRedirectUri(clientId: string, redirectUri: string): boolean {
		const client = this.clients.get(clientId);
		if (!client) return false;

		let target: URL;
		try { target = new URL(redirectUri); } catch { return false; }

		return client.redirectUris.some((uri) => {
			if (uri === redirectUri) return true;
			if (uri.includes('localhost:*')) {
				const isHttp = target.protocol === 'http:' || target.protocol === 'https:';
				return isHttp && (target.hostname === 'localhost' || target.hostname === '127.0.0.1' || target.hostname === '::1');
			}
			try {
				const spec = new URL(uri);
				return spec.origin === target.origin && spec.pathname === target.pathname;
			} catch {
				return false;
			}
		});
	}

	/**
	 * Check if client supports grant type
	 */
	supportsGrantType(clientId: string, grantType: string): boolean {
		const client = this.clients.get(clientId);
		return client ? client.grantTypes.includes(grantType) : false;
	}

	/**
	 * Check if client has required scopes
	 */
	hasScope(clientId: string, requiredScope: string): boolean {
		const client = this.clients.get(clientId);
		return client ? client.scopes.includes(requiredScope) : false;
	}

	/**
	 * List all clients (for admin purposes)
	 */
	listClients(): OAuth2Client[] {
		return Array.from(this.clients.values());
	}

	/**
	 * Generate client ID
	 */
	private generateClientId(): string {
		return `mcp_${crypto.randomUUID().replace(/-/g, '')}`;
	}

	/**
	 * Generate client secret
	 */
	private generateClientSecret(): string {
		// 64 bytes hex (~128 chars) prefixed for readability
		return `mcs_${crypto.randomBytes(64).toString('hex')}`;
	}

	/**
	 * Validate client registration request
	 */
	private validateClientRegistration(request: ClientRegistrationRequest) {
		if (!request.client_name || request.client_name.trim().length === 0) {
			throw new Error('client_name is required');
		}

		if (!request.redirect_uris || request.redirect_uris.length === 0) {
			throw new Error('At least one redirect_uri is required');
		}

		// Validate client type
		if (request.client_type && !['confidential', 'public'].includes(request.client_type)) {
			throw new Error('client_type must be either confidential or public');
		}
	}

	/**
	 * Validate redirect URIs
	 */
	private validateRedirectUris(redirectUris: string[], clientType: 'confidential' | 'public') {
		for (const uri of redirectUris) {
			try {
				const url = new URL(uri.includes('localhost:*') ? uri.replace(':*', ':3000') : uri);

				// Public clients should use secure URLs (except localhost for development)
				const isLoopback =
            url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
        	if (clientType === 'public' && url.protocol !== 'https:' && !isLoopback) {
					throw new Error(`Public clients must use HTTPS redirect URIs: ${uri}`);
				}
			} catch (error) {
				throw new Error(`Invalid redirect URI: ${uri}`);
			}
		}
	}

	/**
	 * Parse and validate scopes
	 */
	private parseAndValidateScopes(scopeString?: string): string[] {
		if (!scopeString) {
			return ['mcp.read']; // Default minimal scope
		}

		const requestedScopes = scopeString.split(' ').filter(s => s.length > 0);
		const validScopes = requestedScopes.filter(scope => this.DEFAULT_SCOPES.includes(scope));

		if (validScopes.length === 0) {
			throw new Error(`No valid scopes requested. Available: ${this.DEFAULT_SCOPES.join(', ')}`);
		}

		return validScopes;
	}
}

// Singleton instance
export const oAuth2ClientManager = new OAuth2ClientManager();
