import * as http from 'node:http';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
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

				// Cache resolved configs for 60 seconds
				cacheTtl: 60_000
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
