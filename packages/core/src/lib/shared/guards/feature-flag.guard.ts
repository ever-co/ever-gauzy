import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { requiredFeatureFlags } from '@gauzy/common';
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
 * The cache key one flag resolves under, for a scope the caller names.
 *
 * The answer `FeatureService.isFeatureEnabled()` returns is scoped to the requesting tenant (and to
 * the organization selected on the request), so the key has to carry both. Exported because whatever
 * evicts a flag entry has to build the same key: an eviction written against a different shape is an
 * eviction that silently misses.
 *
 * The scope is named here rather than read from the request because a writer is not a resolver: the
 * request that switched a flag off is an administrator's, while the entries its write made wrong belong
 * to the scopes the write changed — which for a tenant-wide toggle is every organization of the tenant.
 *
 * @param flag The feature code being resolved.
 * @param tenantId The tenant, or null for a resolution that has none.
 * @param organizationId The organization, or null for a tenant-wide resolution.
 * @returns The tenant- and organization-scoped cache key.
 */
export function featureFlagCacheKeyFor(
	flag: FeatureEnum,
	tenantId?: string | null,
	organizationId?: string | null
): string {
	return `${featureFlagCacheKeyPrefix(tenantId)}${organizationId ?? NO_ORGANIZATION}_${flag}`;
}

/**
 * The cache key one flag resolves under, for the scope of the current request.
 *
 * @param flag The feature code being resolved.
 * @returns The tenant-scoped cache key.
 */
export function featureFlagCacheKey(flag: FeatureEnum): string {
	const { tenantId, organizationId } = featureFlagScope();
	return featureFlagCacheKeyFor(flag, tenantId, organizationId);
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
 * Removes the entries a flag's own write has just made wrong.
 *
 * The guard caches a resolved flag, so without this an administrator who switches a capability off
 * keeps being served it until the entry expires — the entry is the only thing standing between the
 * write and the next request, and until now nothing removed it. The entry is addressed by the same
 * builder the guard reads through, because an eviction written against another key shape deletes a
 * key no resolution ever wrote and looks, from the outside, exactly like an eviction that worked.
 *
 * The scopes are named rather than read from the request: a tenant-wide toggle rewrites the row of
 * every organization that has one, and each of those rows is a cached answer that has just changed.
 * The caller passes the scopes it actually wrote, and this removes one entry per scope.
 *
 * One case stays bounded rather than immediate, and it is stated here because it is a real limit: an
 * organization that has **no** row of its own resolves from the tenant-wide row, so a tenant-wide
 * write leaves that organization's cached answer wrong until it expires. The scopes that have a row
 * — the ones the write touched — are evicted at once, which is why {@link FEATURE_FLAG_CACHE_TTL_MS}
 * is what bounds the remainder rather than what bounds everything.
 *
 * The keys are removed one at a time rather than through the multi-key call: this installation's cache
 * is in memory, Redis, or a two-layer pair depending on how it is deployed, and a store is only
 * obliged to implement the single-key removal. A toggle is written by hand and by nobody else, so the
 * difference in round trips is not worth a deletion that a deployment silently skips.
 *
 * @param cacheManager The cache the guard reads through.
 * @param flag The feature code whose enablement changed.
 * @param tenantId The tenant whose rows were written.
 * @param organizationIds Every organization whose row was written, `null` for the tenant-wide row.
 * @returns How many distinct entries were removed.
 */
export async function evictFeatureFlagEntries(
	cacheManager: Cache,
	flag: FeatureEnum,
	tenantId: string | null,
	organizationIds: Array<string | null>
): Promise<number> {
	const keys = new Set(
		organizationIds.map((organizationId) => featureFlagCacheKeyFor(flag, tenantId, organizationId))
	);

	await Promise.all([...keys].map((key) => cacheManager.del(key)));

	return keys.size;
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
	 *
	 * **Every declared code must be enabled.** `@FeatureFlag` accumulates, so a target can require more
	 * than one code — a plugin resolver requires both `FEATURE_GRAPHQL` (the endpoint) and its own
	 * capability, which is exactly what the capability's REST routes require of it. The codes are the
	 * handler's when it declares any and its class's otherwise (see `requiredFeatureFlags`), and each is
	 * resolved and cached on its own, so a code shared by many routes is resolved once per scope no matter
	 * which set it appears in. They are resolved in declaration order and the first disabled one refuses
	 * the request without resolving the rest. Reading one code with `getAllAndOverride`, as this guard did,
	 * enforced whichever single code was written last and let every other one pass unexamined.
	 *
	 * A handler that declares no code is refused: nothing was named that could be enabled. That was
	 * already the intended outcome of resolving an absent code, only reached through a catalogue lookup
	 * for `code: undefined` — a lookup whose answer depended on how each ORM treats an undefined
	 * criterion, which is not a thing an authorization decision should depend on.
	 *
	 * @param context The execution context of the request.
	 * @returns A boolean indicating whether access is allowed.
	 */
	async canActivate(context: ExecutionContext) {
		const flags = requiredFeatureFlags(this._reflector, context);

		let isEnabled = flags.length > 0;

		for (const flag of flags) {
			if (!(await this.isFlagEnabled(flag))) {
				isEnabled = false;
				break;
			}
		}

		// Check if the feature is enabled
		if (isEnabled) {
			return true;
		}

		// If the feature is not enabled, refuse the request — naming what was refused.
		//
		// The refusal has to read the context it is in. This guard protects REST routes and GraphQL
		// fields alike, and on a GraphQL execution context `switchToHttp().getRequest()` hands back the
		// resolver's first argument rather than a request: destructuring `method` and `url` from it
		// produced a message made of `undefined` at best and a TypeError at worst, so a capability that
		// is switched off denied through the GraphQL door by crashing rather than by refusing. The two
		// contexts are told apart and each names what it actually has.
		const contextType = context.getType<'http' | 'graphql'>();

		if (contextType === 'graphql') {
			// The execution context's arguments are the resolver's own: the root value, the arguments,
			// the context and the field being resolved. Naming the field is the closest thing a GraphQL
			// request has to a URL, and it is what a caller needs in order to know what was refused.
			const info = context.getArgByIndex?.(3) as { fieldName?: string } | undefined;

			throw new NotFoundException(
				info?.fieldName ? `Cannot query field ${info.fieldName}` : 'The requested capability is not enabled.'
			);
		}

		const request = context.switchToHttp().getRequest();
		const { method, url } = request ?? {};

		throw new NotFoundException(`Cannot ${method} ${url}`);
	}

	/**
	 * Whether one feature code is enabled for the scope of the current request, through the cache.
	 *
	 * @param flag The feature code.
	 * @returns True when the code is enabled.
	 */
	private async isFlagEnabled(flag: FeatureEnum): Promise<boolean> {
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

		return isEnabled;
	}
}
