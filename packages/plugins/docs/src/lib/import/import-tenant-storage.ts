import { Injectable, Logger } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { runWithTenantStorageSettings, TenantSettingService } from '@gauzy/core';

/** How long a tenant's settings are reused by background storage work (the settings middleware caches them too). */
export const IMPORT_TENANT_SETTINGS_TTL_MS = 60_000;

/**
 * The tenant's storage settings could not be read, so the work did not run: run with the deployment's storage instead,
 * it would read the wrong file or store the tenant's file in the wrong place. A hiccup to retry.
 */
export class TenantStorageSettingsError extends Error {
	constructor(
		readonly tenantId: ID,
		public readonly cause?: unknown
	) {
		super(`The storage settings of tenant ${tenantId} could not be read: ${(cause as Error)?.message ?? cause}`);
		this.name = 'TenantStorageSettingsError';
	}
}

/**
 * The storage of a tenant for Docs work that runs without a signed-in request: the `docs.import` run (a queue thread),
 * the stalled-import sweep, the `docs.extract` and `docs.thumbnail` jobs, and the capture of a chat attachment. A
 * tenant can keep its own bucket and credentials in its settings, which the storage providers read from the request;
 * here they are read from the database and applied to the work (`runWithTenantStorageSettings`), so the work reads
 * the file from, and stores what it makes in, the bucket the upload used.
 */
@Injectable()
export class ImportTenantStorage {
	private readonly logger = new Logger(ImportTenantStorage.name);
	private readonly cache = new Map<string, { at: number; settings: Record<string, unknown> }>();

	constructor(private readonly tenantSettings: TenantSettingService) {}

	/** Runs storage work with the tenant's own storage settings (the deployment's defaults for those it lacks). */
	async run<T>(tenantId: ID | null | undefined, work: () => Promise<T>): Promise<T> {
		const settings = tenantId ? await this.settingsOf(tenantId) : {};
		return runWithTenantStorageSettings(settings, work);
	}

	/**
	 * The tenant's own settings, as the settings middleware attaches them to a request. A failed read throws: work that
	 * went to the deployment's bucket instead would read the wrong file, or store a tenant's file in the wrong place.
	 */
	private async settingsOf(tenantId: ID): Promise<Record<string, unknown>> {
		const cached = this.cache.get(String(tenantId));
		if (cached && Date.now() - cached.at < IMPORT_TENANT_SETTINGS_TTL_MS) return cached.settings;
		try {
			const settings = ((await this.tenantSettings.getSettings({ where: { tenantId } })) ?? {}) as Record<string, unknown>;
			this.cache.set(String(tenantId), { at: Date.now(), settings });
			return settings;
		} catch (error) {
			const failure = new TenantStorageSettingsError(tenantId, error);
			this.logger.warn(failure.message);
			throw failure;
		}
	}
}
