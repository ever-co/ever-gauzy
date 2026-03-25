import * as http from 'node:http';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { environment } from '@gauzy/config';
import { verify } from 'jsonwebtoken';
import { mountPlaneProxy, MountPlaneProxyResult } from '@ever-gauzy/plugin-integration-plane-api';
import { PlaneIntegrationService } from './plane-integration.service';

/**
 * Service responsible for mounting the Plane proxy in-process.
 *
 * Intercepts all `/api/plane/*` requests at the HTTP server level,
 * resolves per-tenant configuration from the database, and delegates
 * to the @ever-gauzy/plugin-integration-plane-api proxy.
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

			this.proxyResult = mountPlaneProxy(httpServer, {
				prefix: '/api/plane',

				extractTenantId: (req) => this.extractTenantIdFromRequest(req),

				/**
				 * Resolve the tenant's Plane configuration from the database.
				 * Called on cache miss only.
				 */
				resolveConfig: async (req) => {
					const tenantId = this.extractTenantIdFromRequest(req);

					if (!tenantId) {
						throw new Error('Cannot resolve Plane config: no tenant ID in request');
					}

					// Validate that the header/cookie tenant ID matches the JWT claim
					// to prevent cross-tenant proxy access via spoofed headers.
					this.validateTenantFromToken(req, tenantId);

					const config = await this.planeIntegrationService.getConfigForTenant(tenantId);

					if (!config) {
						throw new Error(`Plane integration is not configured or disabled for tenant ${tenantId}`);
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

			this.logger.log('Plane proxy mounted successfully on /api/plane');
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
	 * Validate that the request carries a valid JWT whose tenantId claim
	 * matches the header/cookie-supplied tenant ID.
	 *
	 * Because the proxy is mounted at the raw HTTP server level (before
	 * NestJS guards), this is the primary auth check for proxied requests.
	 * The JWT signature is verified using the application's JWT secret.
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

	/**
	 * Extract tenant ID from the incoming request.
	 * Checks X-TENANT-ID header first, then falls back to tenant-id cookie.
	 */
	private extractTenantIdFromRequest(req: http.IncomingMessage): string | undefined {
		// Try explicit header first
		const tenantIdHeader = req.headers['x-tenant-id'];
		if (tenantIdHeader) {
			return Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
		}

		// Fall back to tenant-id cookie if present
		const cookieHeader = req.headers['cookie'];
		if (cookieHeader) {
			const match = cookieHeader.match(/(?:^|;\s*)tenant-id=([^;]+)/);
			if (match) {
				return decodeURIComponent(match[1]);
			}
		}

		return undefined;
	}
}
