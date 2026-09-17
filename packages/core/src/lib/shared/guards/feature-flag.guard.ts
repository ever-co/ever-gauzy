import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FEATURE_METADATA } from '@gauzy/constants';
import { FeatureEnum } from '@gauzy/contracts';
import { FeatureService } from './../../feature/feature.service';
import { RequestContext } from './../../core/context';

/** Cache key namespace, so a flag entry is recognisable beside every other cache entry. */
const FEATURE_FLAG_CACHE_NAMESPACE = 'featureFlag';

/** Used in place of a tenant when a resolution happens outside a request context. */
const NO_TENANT = 'no-tenant';

/** Used in place of an organization when none is selected on the request. */
const NO_ORGANIZATION = 'no-organization';

/**
 * How long a resolved flag stays cached.
 *
 * A flag's answer is per-tenant data, and the toggle path does not evict it, so the entry must not
 * live forever: without a bound, a tenant that switches a module off keeps being served the module
 * until the process restarts. The tenant and organization are part of the key, so this bound only
 * ever applies to a tenant's own toggles.
 */
const FEATURE_FLAG_CACHE_TTL_MS = 60 * 1000;

/**
 * The tenant and organization a flag is being resolved for, as key segments.
 *
 * Read defensively: `FeatureFlagGuard` also runs for routes reached without a request context (a
 * scheduled job through the guard, a call made outside the CLS scope), and a resolution with no
 * context must still produce a stable, usable key rather than throw. Resolving to placeholders is
 * what keeps such a resolution from colliding with a real tenant's entry.
 *
 * @returns The two segments, in key order.
 */
function featureFlagScope(): { tenantId: string; organizationId: string } {
	try {
		return {
			tenantId: RequestContext.currentTenantId() ?? NO_TENANT,
			organizationId: RequestContext.currentOrganizationId() ?? NO_ORGANIZATION
		};
	} catch {
		return { tenantId: NO_TENANT, organizationId: NO_ORGANIZATION };
	}
}

/**
 * The cache key one flag resolves under.
 *
 * The answer `FeatureService.isFeatureEnabled()` returns is scoped to the requesting tenant (and to
 * the organization selected on the request), so the key has to carry both. Exported because whatever
 * evicts a flag entry has to build the same key: an eviction written against a different shape is an
 * eviction that silently misses.
 *
 * @param flag The feature code being resolved.
 * @returns The tenant-scoped cache key.
 */
export function featureFlagCacheKey(flag: FeatureEnum): string {
	const { tenantId, organizationId } = featureFlagScope();
	return `${featureFlagCacheKeyPrefix(tenantId)}${organizationId}_${flag}`;
}

/**
 * The key prefix every entry of one tenant shares.
 *
 * A toggle written for a tenant invalidates that tenant's entries and nobody else's; a prefix is what
 * lets an invalidator express that, instead of deleting the bare code — which would be a key no
 * resolution ever writes, so the toggled flag would keep serving its old answer.
 *
 * @param tenantId The tenant whose entries are being addressed.
 * @returns The prefix, ending in the separator.
 */
export function featureFlagCacheKeyPrefix(tenantId: string = NO_TENANT): string {
	return `${FEATURE_FLAG_CACHE_NAMESPACE}_${tenantId ?? NO_TENANT}_`;
}

/**
 * Feature enabled/disabled guard
 *
 * @returns
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _reflector: Reflector,
		private readonly featureFlagService: FeatureService
	) {}

	/**
	 * Determines if the current request can be activated based on feature flag metadata.
	 * @param context The execution context of the request.
	 * @returns A boolean indicating whether access is allowed.
	 */
	async canActivate(context: ExecutionContext) {
		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [
			context.getHandler(), // Returns a reference to the handler (method) that will be invoked next in the request pipeline.
			context.getClass() // Returns the *type* of the controller class which the current handler belongs to.
		];

		// Retrieve metadata for a specified key for a specified set of features
		const flag = this._reflector.getAllAndOverride<FeatureEnum>(FEATURE_METADATA, targets);

		/**
		 * 🛑 The key MUST carry the tenant and the organization.
		 *
		 * `FeatureService.isFeatureEnabled()` resolves through the request-scoped repository, so the
		 * ANSWER is tenant-scoped while a key built from the flag alone is not. The first tenant to
		 * resolve a flag stored its own answer under a key every other tenant then read, so one
		 * tenant's modules decided what every other tenant was served for as long as the entry lived:
		 * a tenant that had switched a module off was served the module of whichever tenant resolved
		 * the flag first, and a tenant that had enabled one could be denied it. With a single tenant
		 * this is invisible, which is why it survived until the flags that make it reachable arrived.
		 *
		 * The organization is part of the key as well because a toggle can be organization-scoped: a
		 * resolution made with no organization selected must not share an entry with one made inside
		 * an organization.
		 */
		const cacheKey = featureFlagCacheKey(flag);

		const fromCache = await this.cacheManager.get<boolean | null>(cacheKey);

		let isEnabled: boolean;

		if (fromCache == null) {
			isEnabled = await this.featureFlagService.isFeatureEnabled(flag);
			await this.cacheManager.set(cacheKey, isEnabled, FEATURE_FLAG_CACHE_TTL_MS);
		} else {
			isEnabled = fromCache;
		}

		// Check if the feature is enabled
		if (isEnabled) {
			return true;
		}

		// If the feature is not enabled, throw a NotFoundException
		const { method, url } = context.switchToHttp().getRequest();
		throw new NotFoundException(`Cannot ${method} ${url}`);
	}
}
