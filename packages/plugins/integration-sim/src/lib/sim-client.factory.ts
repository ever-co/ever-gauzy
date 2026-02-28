/// <reference path="./typings.d.ts" />
import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { SimStudioClient as SimStudioClientType } from 'simstudio-ts-sdk';
import { IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import { ConfigService } from '@gauzy/config';
import { IntegrationTenantService } from '@gauzy/core';
import { SimSettingName } from './interfaces/sim.types';
import { SIM_DEFAULT_BASE_URL } from './sim.config';

/**
 * Dynamically import the ESM-only simstudio-ts-sdk package.
 *
 * TypeScript with `module: "commonjs"` transforms `await import(...)` into
 * `require(...)`, which fails for ESM-only packages at runtime. Using
 * `new Function` creates a real ESM dynamic import that Node.js can resolve.
 *
 * The module specifier is hardcoded to ensure only the trusted package is loaded.
 */
const dynamicImport = new Function('return import("simstudio-ts-sdk")');

async function loadSimStudioClient(): Promise<new (config: { apiKey: string; baseUrl?: string }) => SimStudioClientType> {
	const mod = await dynamicImport();
	return mod.SimStudioClient || mod.default;
}

@Injectable()
export class SimClientFactory {
	private readonly logger = new Logger(SimClientFactory.name);
	private readonly clients = new Map<string, SimStudioClientType>();

	/** Tracks in-flight client creation promises to prevent duplicate work under concurrency. */
	private readonly pending = new Map<string, Promise<SimStudioClientType>>();

	/** Cache key for the default (global API key) client */
	private static readonly DEFAULT_CLIENT_KEY = '__default__';

	constructor(
		private readonly configService: ConfigService,
		private readonly integrationTenantService: IntegrationTenantService
	) {}

	/**
	 * Get or create a SIM client for the given integration tenant.
	 * Clients are cached per integrationId for performance.
	 *
	 * Falls back to the global GAUZY_SIM_API_KEY if the tenant has no API key configured.
	 */
	async getClient(integrationId: string): Promise<SimStudioClientType> {
		// Return cached client if available
		if (this.clients.has(integrationId)) {
			return this.clients.get(integrationId)!;
		}

		// If another request is already creating this client, await its result
		if (this.pending.has(integrationId)) {
			return this.pending.get(integrationId)!;
		}

		// Create the client and register the in-flight promise so concurrent
		// callers share the same work instead of duplicating DB queries.
		const promise = this.createClient(integrationId);
		this.pending.set(integrationId, promise);

		try {
			const client = await promise;
			return client;
		} finally {
			this.pending.delete(integrationId);
		}
	}

	/**
	 * Internal: create and cache a new SIM client for the given integration tenant.
	 */
	private async createClient(integrationId: string): Promise<SimStudioClientType> {
		// Load integration tenant with settings
		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationId },
				relations: ['settings']
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant) {
			throw new BadRequestException('SIM integration tenant not found');
		}

		// 1. Try tenant-specific API key
		let apiKey = integrationTenant.settings?.find(
			(s: IIntegrationSetting) => s.settingsName === SimSettingName.API_KEY
		)?.settingsValue;

		// 2. Fallback to global config (GAUZY_SIM_API_KEY)
		if (!apiKey) {
			const globalApiKey = this.configService.get('sim')?.apiKey;
			if (globalApiKey) {
				this.logger.warn(
					`No tenant-specific SIM API key found for integration ${integrationId}. ` +
						'Falling back to global GAUZY_SIM_API_KEY env variable.'
				);
				apiKey = globalApiKey;
			}
		}

		if (!apiKey) {
			throw new BadRequestException(
				'SIM API key not configured. Set a per-tenant API key via setupIntegration or set GAUZY_SIM_API_KEY globally.'
			);
		}

		const SimStudioClient = await loadSimStudioClient();
		const client = new SimStudioClient({
			apiKey,
			baseUrl: SIM_DEFAULT_BASE_URL
		});

		// Cache the client
		this.clients.set(integrationId, client);
		this.logger.log(`SIM client created for integration ${integrationId}`);

		return client;
	}

	/**
	 * Create a SIM client using the global API key (no tenant-specific integration required).
	 * Useful for testing or default tenant operations.
	 */
	async getDefaultClient(): Promise<SimStudioClientType> {
		const key = SimClientFactory.DEFAULT_CLIENT_KEY;

		// Check cache first
		if (this.clients.has(key)) {
			return this.clients.get(key)!;
		}

		// If another request is already creating the default client, await its result
		if (this.pending.has(key)) {
			return this.pending.get(key)!;
		}

		const promise = (async (): Promise<SimStudioClientType> => {
			const globalApiKey = this.configService.get('sim')?.apiKey;
			if (!globalApiKey) {
				throw new BadRequestException(
					'Global SIM API key not configured. Set GAUZY_SIM_API_KEY environment variable.'
				);
			}

			const SimStudioClient = await loadSimStudioClient();
			const client = new SimStudioClient({
				apiKey: globalApiKey,
				baseUrl: SIM_DEFAULT_BASE_URL
			});

			this.clients.set(key, client);
			this.logger.log('Default SIM client created using global GAUZY_SIM_API_KEY');

			return client;
		})();

		this.pending.set(key, promise);

		try {
			return await promise;
		} finally {
			this.pending.delete(key);
		}
	}

	/**
	 * Invalidate cached client when credentials change.
	 */
	invalidateClient(integrationId: string): void {
		this.clients.delete(integrationId);
		this.pending.delete(integrationId);
		this.logger.log(`SIM client cache invalidated for integration ${integrationId}`);
	}

	/**
	 * Invalidate the cached default client (e.g. when GAUZY_SIM_API_KEY changes).
	 */
	invalidateDefaultClient(): void {
		this.clients.delete(SimClientFactory.DEFAULT_CLIENT_KEY);
		this.pending.delete(SimClientFactory.DEFAULT_CLIENT_KEY);
		this.logger.log('Default SIM client cache invalidated');
	}
}
