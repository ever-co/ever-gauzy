import * as http from 'node:http';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { environment } from '@gauzy/config';
import { verify } from 'jsonwebtoken';
import { mountPlaneProxy, MountPlaneProxyResult } from '@ever-gauzy/plugin-integration-plane-api';
import { PlaneIntegrationService } from './plane-integration.service';

const PROXY_PREFIX = '/api/plane';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Property attached to the request object to carry the resolved tenant ID
 * between extractTenantId and resolveConfig callbacks.
 */
const REQ_TENANT_ID = '__planeResolvedTenantId';

/**
 * Service responsible for mounting the Plane proxy in-process.
 *
 * Intercepts all `/api/plane/*` requests at the HTTP server level,
 * resolves per-tenant configuration from the database, and delegates
 * to the @ever-gauzy/plugin-integration-plane-api proxy.
 *
 * Tenant identification strategy (in priority order):
 *   1. X-TENANT-ID header (Gauzy internal calls)
 *   2. tenant-id cookie (Gauzy browser sessions)
 *   3. UUID segment in URL path — the Plane UI is configured with
 *      VITE_API_BASE_URL=http://host/api/plane/{tenantId}
 *      so every request arrives as /api/plane/{tenantId}/auth/email-check etc.
 *      The UUID is extracted and the path is rewritten before forwarding.
 */
@Injectable()
export class PlaneProxyService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(PlaneProxyService.name);
	private proxyResult: MountPlaneProxyResult | null = null;

	constructor(
		private readonly httpAdapterHost: HttpAdapterHost,
		private readonly planeIntegrationService: PlaneIntegrationService
	) {}

	/**
	 * Mount the Plane proxy on module initialization.
	 */
	async onModuleInit(): Promise<void> {
		try {
			const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();

			// Path<->session binding (extractSessionTenantId) needs JWT_SECRET to verify the
			// session cookie. Without it every request silently falls back to trusting the
			// URL tenant, re-opening the confused-deputy. Fail loudly instead of silently.
			if (!environment.JWT_SECRET) {
				this.logger.error(
					'JWT_SECRET is not configured — the Plane proxy cannot bind the path tenant to ' +
						'the authenticated session and will fall back to trusting the URL tenant. Set ' +
						'JWT_SECRET so session-based tenant resolution is enforced.'
				);
			}

			this.proxyResult = mountPlaneProxy(httpServer, {
				prefix: PROXY_PREFIX,

				/**
				 * Extract tenant ID from every request AND validate the JWT.
				 * This runs on every request (including cache hits), ensuring
				 * that authentication is never skipped.
				 */
				extractTenantId: (req) => {
					// Always strip a UUID path segment first so the downstream proxy app
					// sees a clean URL regardless of which tenant signal wins below.
					const pathTenantId = this.extractTenantIdFromPath(req);

					// 1. Explicit header / cookie (Gauzy-originated calls) — JWT-validated.
					const headerTenantId = this.extractTenantIdFromHeaders(req);
					if (headerTenantId) {
						this.validateTenantFromToken(req, headerTenantId);
						(req as any)[REQ_TENANT_ID] = headerTenantId;
						return headerTenantId;
					}

					// 2. The authenticated session cookie is the SOURCE OF TRUTH for the
					//    tenant. When a valid session is present it OVERRIDES the path
					//    UUID, so a request can never be served with another tenant's
					//    resolved config (apiKey / apiSecret / CORS origins) while it
					//    carries a different tenant's session. Closes the confused-deputy
					//    where an attacker swaps in someone else's tenant UUID.
					const sessionTenantId = this.extractSessionTenantId(req);
					if (sessionTenantId) {
						if (pathTenantId && pathTenantId !== sessionTenantId) {
							this.logger.warn(
								`Plane proxy: path tenant ${pathTenantId} does not match the ` +
									`authenticated session tenant ${sessionTenantId}; serving the ` +
									`session tenant.`
							);
						}
						(req as any)[REQ_TENANT_ID] = sessionTenantId;
						return sessionTenantId;
					}

					// 3. No session yet — public bootstrap (auth/email-check, login,
					//    api/instances). Fall back to the path tenant so CORS and the
					//    email-check API key resolve for the right tenant.
					if (pathTenantId) {
						(req as any)[REQ_TENANT_ID] = pathTenantId;
						return pathTenantId;
					}

					return undefined;
				},

				/**
				 ** Resolve the tenant's Plane configuration from the database.
				 * Called on cache miss only.
				 *
				 * When no tenant ID is present (public routes like /api/instances/,
				 * /api/timezones, auth/*), returns a default config so the proxy
				 * can still forward the request and handle CORS.
				 */
				resolveConfig: async (req) => {
					const tenantId: string | undefined = (req as any)[REQ_TENANT_ID];

					if (!tenantId) {
						return this.getDefaultProxyConfig();
					}

					const config = await this.planeIntegrationService.getConfigForTenant(tenantId);

					if (!config) {
						this.logger.warn(`No Plane config for tenant ${tenantId}, using default`);
						return this.getDefaultProxyConfig();
					}

					return {
						externalBaseApiUrl: config.externalBaseApiUrl,
						apiKey: config.apiKey,
						apiSecret: config.apiSecret,
						clientBaseUrl: config.clientBaseUrl,
						clientAdminUrl: config.clientAdminUrl,
						clientSpaceUrl: config.clientSpaceUrl
					};
				},

				// Short TTL to minimize stale-config window after settings changes
				// or integration removal. MountPlaneProxyResult does not expose
				// cache invalidation, so a low TTL is the safest mitigation.
				cacheTtl: 5_000
			});

			this.logger.log('Plane proxy mounted on /api/plane (tenant-in-path enabled)');
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			const stack = error instanceof Error ? error.stack : undefined;
			this.logger.error(`Failed to mount Plane proxy: ${message}`, stack);
		}
	}

	/**
	 * Gracefully shut down the Plane proxy on module destroy.
	 */
	async onModuleDestroy(): Promise<void> {
		if (this.proxyResult) {
			await this.proxyResult.shutdown();
			this.logger.log('Plane proxy shut down');
		}
	}

	/**
	 * Default proxy config used when no tenant can be identified.
	 * Allows public endpoints (/api/instances/, /api/timezones) to work
	 * and provides CORS origins for Plane UI dev ports.
	 */
	private getDefaultProxyConfig() {
		const baseUrl = environment.baseUrl || 'http://localhost:3000';
		return {
			externalBaseApiUrl: `${baseUrl}/api`,
			apiKey: '',
			apiSecret: '',
			clientBaseUrl: process.env['PLANE_CLIENT_BASE_URL'] || 'http://localhost:3001',
			clientAdminUrl: process.env['PLANE_CLIENT_ADMIN_URL'] || 'http://localhost:3002',
			clientSpaceUrl: process.env['PLANE_CLIENT_SPACE_URL'] || 'http://localhost:3003'
		};
	}

	// ── Tenant ID extraction ──────────────────────────────────────────

	/**
	 * Extract tenant ID from a UUID segment in the URL path.
	 *
	 * Given:  /api/plane/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/auth/email-check
	 * Result: tenantId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
	 *         req.url rewritten to /api/plane/auth/email-check
	 */
	private extractTenantIdFromPath(req: http.IncomingMessage): string | undefined {
		const url = req.url || '';
		if (!url.startsWith(PROXY_PREFIX + '/')) return undefined;

		const afterPrefix = url.slice(PROXY_PREFIX.length + 1); // strip "/api/plane/"
		const slashIdx = afterPrefix.indexOf('/');
		const firstSegment = slashIdx === -1 ? afterPrefix : afterPrefix.slice(0, slashIdx);

		if (!UUID_RE.test(firstSegment)) return undefined;

		const rest = slashIdx === -1 ? '' : afterPrefix.slice(slashIdx);
		req.url = PROXY_PREFIX + rest;

		return firstSegment;
	}

	/**
	 * Extract tenant ID from X-TENANT-ID header or tenant-id cookie.
	 */
	private extractTenantIdFromHeaders(req: http.IncomingMessage): string | undefined {
		const tenantIdHeader = req.headers['x-tenant-id'];
		if (tenantIdHeader) {
			return Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
		}

		const cookieHeader = req.headers['cookie'];
		if (cookieHeader) {
			const match = cookieHeader.match(/(?:^|;\s*)tenant-id=([^;]+)/);
			if (match) {
				return decodeURIComponent(match[1]);
			}
		}

		return undefined;
	}

	// ── Session-based tenant resolution ──────────────────

	/**
	 * Read and verify the Gauzy JWT carried by the chunked
	 * `auth-proxy-plane-token-*` cookies and return its `tenantId` claim.
	 *
	 * Returns `undefined` when no session cookie is present (unauthenticated
	 * bootstrap) or when JWT_SECRET is not configured (e.g. a standalone proxy
	 * that does not share Gauzy's signing secret). A present-but-invalid or
	 * expired cookie is also treated as no session: the forwarded Bearer is the
	 * same token and Gauzy rejects it with 401, letting the Plane UI
	 * re-authenticate gracefully instead of the proxy hard-failing the request.
	 */
	private extractSessionTenantId(req: http.IncomingMessage): string | undefined {
		const token = this.readSessionToken(req);
		if (!token) {
			return undefined;
		}

		const jwtSecret = environment.JWT_SECRET;
		if (!jwtSecret) {
			return undefined;
		}

		try {
			const payload = verify(token, jwtSecret) as { tenantId?: string };
			return payload.tenantId || undefined;
		} catch (error) {
			this.logger.debug(
				`Ignoring invalid/expired Plane proxy session cookie: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return undefined;
		}
	}

	/**
	 * Reassemble the chunked `auth-proxy-plane-token-{0,1,...}` cookie into the
	 * raw JWT string from the raw `Cookie` header (cookies are not parsed yet at
	 * the HTTP-server interception layer).
	 */
	private readSessionToken(req: http.IncomingMessage): string | undefined {
		const cookieHeader = req.headers['cookie'];
		if (!cookieHeader) {
			return undefined;
		}

		const jar: Record<string, string> = {};
		for (const part of cookieHeader.split(';')) {
			const eq = part.indexOf('=');
			if (eq === -1) {
				continue;
			}
			const key = part.slice(0, eq).trim();
			if (key) {
				jar[key] = part.slice(eq + 1).trim();
			}
		}

		const chunks: string[] = [];
		for (let index = 0; jar[`auth-proxy-plane-token-${index}`] !== undefined; index++) {
			chunks.push(jar[`auth-proxy-plane-token-${index}`]);
		}

		return chunks.length > 0 ? chunks.join('') : undefined;
	}

	// ── JWT validation ────────────────────────────────────────────────

	/**
	 * Validate that the request carries a valid Gauzy JWT whose tenantId
	 * claim matches the header/cookie-supplied tenant ID.
	 *
	 * Only called for header/cookie-based tenant extraction (Gauzy calls).
	 * Plane UI calls use the path-based tenant ID and are authenticated
	 * by the proxy's own cookie-based auth (auth-proxy-plane-token-*).
	 */
	private validateTenantFromToken(req: http.IncomingMessage, headerTenantId: string): void {
		const authHeader = req.headers['authorization'];
		if (!authHeader?.startsWith('Bearer ')) {
			throw new Error('Plane proxy requires an authenticated request (missing Bearer token)');
		}

		const token = authHeader.slice(7);
		const jwtSecret = environment.JWT_SECRET;

		if (!jwtSecret) {
			throw new Error('JWT_SECRET is not configured — cannot verify proxy requests');
		}

		try {
			const payload = verify(token, jwtSecret) as { tenantId?: string };
			const tokenTenantId = payload.tenantId;

			if (!tokenTenantId) {
				throw new Error('Bearer token does not contain a tenantId claim');
			}

			if (tokenTenantId !== headerTenantId) {
				this.logger.warn(
					`Cross-tenant proxy access blocked: token tenant ${tokenTenantId} != header tenant ${headerTenantId}`
				);
				throw new Error('Tenant ID mismatch: token tenant does not match requested tenant');
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'JsonWebTokenError') {
				throw new Error('Plane proxy received an invalid or expired Bearer token');
			}
			if (error instanceof Error && error.name === 'TokenExpiredError') {
				throw new Error('Plane proxy received an expired Bearer token');
			}
			throw error;
		}
	}
}
