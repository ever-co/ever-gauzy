import { Injectable, Logger } from '@nestjs/common';
import { FeatureEnum, ID } from '@gauzy/contracts';
import { FeatureOrganizationService, FeatureService } from '@gauzy/core';
import { DOCS_FEATURE_CACHE_TTL_MS } from '../docs.constants';

/** One memoized answer of {@link DocsFeatureService.isEnabledFor}. */
interface IFeatureCacheEntry {
	enabled: boolean;
	expiresAt: number;
}

/**
 * Worker-safe resolution of the `FEATURE_DOCUMENTS` toggle for an explicit tenant/organization.
 *
 * The REST layer has `FeatureFlagGuard`, but the pipeline does not: a `docs.extract` job that was
 * enqueued while the feature was on keeps running after an admin turns it off, and the recovery
 * sweep happily re-drives it. This service is what lets the pipeline honour the flag too.
 *
 * 🛑 It cannot go through the inherited `FeatureOrganizationService` finders: they are
 * `TenantAwareCrudService` methods that merge the tenant off `RequestContext`, and queue threads
 * have none. The tenant/organization pair therefore comes from the job snapshot and is applied
 * explicitly, through the service's own repository.
 *
 * Answers are memoized for {@link DOCS_FEATURE_CACHE_TTL_MS} so a batch of stage transitions
 * costs one lookup rather than one per stage, and **every** failure resolves to `true`: a flag
 * lookup that cannot be answered must not silently park an organization's whole pipeline.
 */
@Injectable()
export class DocsFeatureService {
	private readonly logger = new Logger(DocsFeatureService.name);

	/** `${tenantId}:${organizationId}` → memoized answer. */
	private readonly cache = new Map<string, IFeatureCacheEntry>();

	constructor(
		private readonly featureService: FeatureService,
		private readonly featureOrganizationService: FeatureOrganizationService
	) {}

	/**
	 * Whether `FEATURE_DOCUMENTS` is enabled for the given scope.
	 *
	 * Resolution order (most specific wins): the organization's own `feature_organization` row,
	 * then the tenant-wide row (`organizationId` null — what `updateTenantFeatureOrganizations`
	 * seeds), then whatever the core `FeatureService` says globally (which itself falls back to
	 * the `@gauzy/config` toggle when no `feature` row exists).
	 *
	 * @param tenantId The tenant scope (from the job snapshot).
	 * @param organizationId The organization scope (from the job snapshot).
	 * @returns True when the pipeline may process work for this scope.
	 */
	public async isEnabledFor(tenantId: ID, organizationId?: ID): Promise<boolean> {
		if (!tenantId) {
			return true; // nothing to scope the lookup by — never park on a missing snapshot
		}
		const key = `${tenantId}:${organizationId ?? ''}`;
		const cached = this.cache.get(key);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.enabled;
		}

		let enabled = true;
		try {
			enabled = await this.resolve(tenantId, organizationId);
		} catch (error) {
			// Fail OPEN: an unreadable flag must never park the pipeline for a whole tenant.
			this.logger.warn(
				`Could not resolve ${FeatureEnum.FEATURE_DOCUMENTS} for tenant ${tenantId}: ` +
					`${(error as Error).message} — treating it as enabled.`
			);
			enabled = true;
		}

		this.cache.set(key, { enabled, expiresAt: Date.now() + DOCS_FEATURE_CACHE_TTL_MS });
		return enabled;
	}

	/** Test/ops seam: drops the memoized answers. */
	public resetCache(): void {
		this.cache.clear();
	}

	/**
	 * The uncached lookup behind {@link isEnabledFor}.
	 */
	private async resolve(tenantId: ID, organizationId?: ID): Promise<boolean> {
		const rows = await this.featureOrganizationService.typeOrmFeatureOrganizationRepository.find({
			where: { tenantId, feature: { code: FeatureEnum.FEATURE_DOCUMENTS } },
			relations: { feature: true }
		});
		const scoped =
			(organizationId ? rows.find((row) => row.organizationId === organizationId) : undefined) ??
			rows.find((row) => !row.organizationId);
		if (scoped) {
			return scoped.isEnabled === true;
		}
		// No per-tenant row — the global toggle (with the core's own config fallback) decides.
		return this.featureService.isFeatureEnabled(FeatureEnum.FEATURE_DOCUMENTS);
	}
}
