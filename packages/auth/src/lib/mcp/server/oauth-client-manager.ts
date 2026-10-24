/**
 * OAuth 2.0 Client Management
 *
 * Manages OAuth 2.0 client registration and validation for MCP authorization
 */

import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { SecurityLogger } from '../utils/security-logger';
import { ClientRegistrationResponse } from '../interfaces';
import { VerifiedClientSecretCache } from './oauth-client-secret-cache';

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


/**
 * Bounds on one registration request. `POST /oauth2/register` is open to anyone and every client is kept in memory,
 * so a request may hold only what a real client needs.
 */
export const CLIENT_REGISTRATION_LIMITS = Object.freeze({
	clientNameLength: 200,
	redirectUris: 10,
	urlLength: 2048,
	listEntries: 5,
	listEntryLength: 64,
	scopeLength: 512,
	metadataBytes: 4096
});

/**
 * Clients registered through `POST /oauth2/register` kept at once (the store is in memory). Past it, a client is
 * forgotten rather than every new client being refused: first the oldest that never obtained a token, then the least
 * recently used. Registration is open to anyone, but only a person signing in turns a registration into a client that
 * obtained a token, so a flood of registrations displaces other unused registrations, never a client in use.
 */
export const MAX_DYNAMIC_CLIENTS = 5000;

/** The shortest secret a resource server may authenticate with */
export const MIN_RESOURCE_SERVER_SECRET_LENGTH = 32;

export class OAuth2ClientManager {
	private clients = new Map<string, OAuth2Client>();
	// Clients registered without an id of the operator's (dynamic registration) that never obtained a token, oldest first
	private readonly unusedDynamicClientIds = new Set<string>();
	// Dynamically registered clients that obtained a token (see {@link markClientUsed}), least recently used first
	private readonly usedDynamicClientIds = new Set<string>();
	/** The clients registered by {@link registerResourceServer}: the only ones the introspection endpoint answers */
	private readonly resourceServerIds = new Set<string>();
	private securityLogger: SecurityLogger;

	// Default supported scopes for MCP
	private readonly DEFAULT_SCOPES = ['mcp.read', 'mcp.write', 'mcp.admin'];
	private readonly DEFAULT_GRANT_TYPES = ['authorization_code', 'refresh_token'];
	private readonly DEFAULT_RESPONSE_TYPES = ['code'];

	/**
	 * @param maxDynamicClients - How many dynamically registered clients are kept at most.
	 * @param verifiedSecrets - The secrets recently verified with bcrypt (see {@link validateClient}).
	 */
	constructor(
		private readonly maxDynamicClients = MAX_DYNAMIC_CLIENTS,
		private readonly verifiedSecrets = new VerifiedClientSecretCache()
	) {
		this.securityLogger = new SecurityLogger();
	}

	/**
	 * Register well-known MCP clients (ChatGPT, Claude) as public clients.
	 *
	 * These are the primary MCP ecosystem clients with stable, well-known redirect URIs.
	 * Pre-registering them allows out-of-the-box connectivity without manual setup.
	 *
	 * - All default clients are public (no secrets stored)
	 * - Registration is non-blocking: if a client ID already exists (e.g., admin registered
	 *   a custom one), the default is silently skipped
	 * - Additional clients can be registered dynamically via POST /oauth2/register
	 */
	async registerDefaultClients(): Promise<void> {
		const defaults: Array<{ id: string; request: ClientRegistrationRequest }> = [
			{
				id: 'chatgpt-mcp-client',
				request: {
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
					client_uri: 'https://chatgpt.com',
					metadata: { integration_type: 'chatgpt', default_client: true }
				}
			},
			{
				id: 'claude-mcp-client',
				request: {
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
					metadata: { integration_type: 'claude', default_client: true }
				}
			}
		];

		for (const { id, request } of defaults) {
			try {
				// Skip if a client with this ID already exists (admin may have registered a custom one)
				if (this.clients.has(id)) {
					this.securityLogger.log(`Default client '${id}' skipped: already registered`);
					continue;
				}
				await this.registerClient(request, id);
			} catch (err) {
				// Non-blocking: log and continue — default clients should never prevent server startup
				this.securityLogger.warn(`Default client '${id}' registration skipped: ${(err as Error).message}`);
			}
		}

		this.securityLogger.log(`Default MCP clients initialized (${this.clients.size} registered)`);
	}

	/**
	 * Registers a resource server the operator configured: a confidential client with the given secret that may
	 * call the introspection endpoint and nothing else (no redirect URIs, no grants). The MCP server is one; it
	 * asks whether each bearer token it is shown is active.
	 *
	 * @param clientId - The client id the resource server authenticates with.
	 * @param clientSecret - Its secret, at least {@link MIN_RESOURCE_SERVER_SECRET_LENGTH} characters.
	 * @throws When the secret is too short or the client id is taken.
	 */
	async registerResourceServer(clientId: string, clientSecret: string): Promise<void> {
		if (!clientId || !clientSecret || clientSecret.length < MIN_RESOURCE_SERVER_SECRET_LENGTH) {
			throw new Error(
				`A resource server needs a client id and a secret of at least ${MIN_RESOURCE_SERVER_SECRET_LENGTH} characters`
			);
		}
		if (this.clients.has(clientId)) {
			throw new Error(`client_id already exists: ${clientId}`);
		}
		const now = new Date();
		this.clients.set(clientId, {
			clientId,
			clientSecretHash: await bcrypt.hash(clientSecret, 12),
			clientName: 'Resource server',
			clientType: 'confidential',
			redirectUris: [],
			grantTypes: [],
			responseTypes: [],
			scopes: [],
			createdAt: now,
			updatedAt: now,
			isActive: true,
			metadata: { resource_server: true }
		});
		this.resourceServerIds.add(clientId);
		this.securityLogger.log(`Resource server registered: ${clientId}`);
	}

	/**
	 * Whether a client is a resource server the operator registered ({@link registerResourceServer}).
	 *
	 * Decided by that registration alone, never by the client's `metadata`: a dynamic registration
	 * (`POST /oauth2/register`, open to anyone) stores the `metadata` it is sent, so a self-registered confidential
	 * client could claim `{ "resource_server": true }` and be answered at the introspection endpoint.
	 */
	isResourceServer(client: OAuth2Client | null | undefined): boolean {
		return !!client && client.clientType === 'confidential' && this.resourceServerIds.has(client.clientId);
	}

	/**
	 * Register a new OAuth 2.0 client (public or confidential)
	 *
	 * - Public clients: No client_secret is generated (e.g., SPAs, native apps)
	 * - Confidential clients: A client_secret is generated and hashed (e.g., server-side apps)
	 *
	 * Clients can also be registered dynamically via POST /oauth2/register.
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
			if (!customClientId) {
				this.rememberDynamicClient(clientId);
			}

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
	 * Validate client credentials.
	 *
	 * A confidential client's secret is compared with its stored bcrypt hash (cost 12). The resource server
	 * authenticates on every introspection request, so a secret verified in the last few minutes against the same
	 * stored hash is taken as right without bcrypt ({@link VerifiedClientSecretCache}); a wrong secret is always
	 * compared with bcrypt, and a missing or disabled client is refused before the cache is asked.
	 */
	async validateClient(clientId: string, clientSecret?: string): Promise<OAuth2Client | null> {
		const client = this.clients.get(clientId);

		if (!client || !client.isActive) {
			this.verifiedSecrets.forget(clientId);
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

		const isValidSecret = await this.verifiedSecrets.verify(
			clientId,
			clientSecret,
			client.clientSecretHash,
			(secret, secretHash) => bcrypt.compare(secret, secretHash)
		);
		if (!isValidSecret) {
			return null;
		}
		// Removed or disabled while its secret was compared: the success just remembered is dropped too, so the client
		// is verified with bcrypt again once it is back
		if (this.clients.get(clientId) !== client || !client.isActive) {
			this.verifiedSecrets.forget(clientId);
			return null;
		}
		return client;
	}

	/**
	 * Records that a client obtained tokens (an authorization code exchanged, or a refresh token used): a dynamically
	 * registered client is then forgotten only after every client that never obtained one, and after the clients used
	 * less recently. Call it only once tokens are issued, never on client authentication alone: a public client
	 * authenticates with no secret, so anyone could otherwise mark the clients they registered as used.
	 *
	 * @param clientId - The client the tokens were issued to. A client the operator registered is never forgotten.
	 */
	markClientUsed(clientId: string): void {
		if (!this.unusedDynamicClientIds.delete(clientId) && !this.usedDynamicClientIds.delete(clientId)) {
			return;
		}
		// Re-inserted last: the most recently used
		this.usedDynamicClientIds.add(clientId);
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
		const limits = CLIENT_REGISTRATION_LIMITS;

		if (typeof request?.client_name !== 'string' || request.client_name.trim().length === 0) {
			throw new Error('client_name is required');
		}
		if (request.client_name.length > limits.clientNameLength) {
			throw new Error(`client_name must be at most ${limits.clientNameLength} characters`);
		}

		if (!Array.isArray(request.redirect_uris) || request.redirect_uris.length === 0) {
			throw new Error('At least one redirect_uri is required');
		}
		if (request.redirect_uris.length > limits.redirectUris) {
			throw new Error(`At most ${limits.redirectUris} redirect_uris are allowed`);
		}
		if (request.redirect_uris.some((uri) => typeof uri !== 'string' || uri.length > limits.urlLength)) {
			throw new Error(`Each redirect_uri must be a string of at most ${limits.urlLength} characters`);
		}

		for (const field of ['grant_types', 'response_types'] as const) {
			const list = request[field];
			if (list === undefined) {
				continue;
			}
			if (
				!Array.isArray(list) ||
				list.length > limits.listEntries ||
				list.some((entry) => typeof entry !== 'string' || entry.length > limits.listEntryLength)
			) {
				throw new Error(`${field} must be a list of at most ${limits.listEntries} short strings`);
			}
		}

		if (
			request.scope !== undefined &&
			(typeof request.scope !== 'string' || request.scope.length > limits.scopeLength)
		) {
			throw new Error(`scope must be a string of at most ${limits.scopeLength} characters`);
		}

		for (const field of ['logo_uri', 'client_uri', 'policy_uri', 'tos_uri'] as const) {
			const value = request[field];
			if (value !== undefined && (typeof value !== 'string' || value.length > limits.urlLength)) {
				throw new Error(`${field} must be a string of at most ${limits.urlLength} characters`);
			}
		}

		if (request.metadata !== undefined) {
			let size: number;
			try {
				size = Buffer.byteLength(JSON.stringify(request.metadata) ?? '', 'utf8');
			} catch {
				throw new Error('metadata must be a JSON object');
			}
			if (size > limits.metadataBytes) {
				throw new Error(`metadata must be at most ${limits.metadataBytes} bytes`);
			}
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
	 * Keeps a dynamically registered client, making room first when {@link MAX_DYNAMIC_CLIENTS} are kept: the oldest
	 * client that never obtained a token is forgotten, or, when every client did, the least recently used one. An
	 * anonymous flood of registrations therefore only displaces registrations nobody signed in through.
	 */
	private rememberDynamicClient(clientId: string): void {
		while (this.unusedDynamicClientIds.size + this.usedDynamicClientIds.size >= this.maxDynamicClients) {
			const neverUsed = this.unusedDynamicClientIds.size > 0;
			const pool = neverUsed ? this.unusedDynamicClientIds : this.usedDynamicClientIds;
			const forgotten = pool.values().next();
			if (forgotten.done) {
				break;
			}
			pool.delete(forgotten.value);
			this.clients.delete(forgotten.value);
			this.verifiedSecrets.forget(forgotten.value);
			this.securityLogger.warn(
				`Dynamic client registry full: forgot the ${neverUsed ? 'oldest unused' : 'least recently used'} client ${
					forgotten.value
				}`
			);
		}
		this.unusedDynamicClientIds.add(clientId);
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
