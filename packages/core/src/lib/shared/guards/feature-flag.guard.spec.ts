/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service: the guard imports
 * `FeatureService`, whose entity graph reaches resolvers that apply this very guard, and entering the graph
 * through the guard leaves it undefined when they do. Entering through the entities is the order that works.
 */
import '../../core/entities/internal';

import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlag } from '@gauzy/common';
import { FEATURE_METADATA } from '@gauzy/constants';
import { FeatureEnum } from '@gauzy/contracts';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { featureFlagCacheKey, FeatureFlagGuard } from './feature-flag.guard';

/**
 * `FeatureFlagGuard` requires EVERY code a handler declares, or — when the handler declares none — every code
 * its class declares.
 *
 * `@FeatureFlag` used to write one metadata value per target and the guard read one with
 * `getAllAndOverride`, so a plugin resolver that stated `@FeatureFlag(FEATURE_GRAPHQL)` above its own
 * capability's code was gated on the endpoint alone: with the capability switched off, its REST routes
 * answered 404 while its mutations kept running over GraphQL. The classes below state their codes exactly
 * the way those resolvers do, through the real decorator, and the guard is driven through a real `Reflector`.
 */

/** A capability's own code, beside the endpoint's: what a plugin resolver states next to `FEATURE_GRAPHQL`. */
const CAPABILITY = FeatureEnum.FEATURE_INVOICE;

/** A code a single handler states for itself. */
const HANDLER_CODE = FeatureEnum.FEATURE_ESTIMATE;

/** Stated the way the warehouse resolvers state it: the endpoint above the capability. */
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(CAPABILITY)
class TwoCodeResolver {
	/** Inherits both of the class's codes. */
	refundThing() {
		return 'refunded';
	}

	/** States its own code, which replaces the class's two. */
	@FeatureFlag(HANDLER_CODE)
	estimateThing() {
		return 'estimated';
	}

	/** States two codes of its own. */
	@FeatureFlag(HANDLER_CODE)
	@FeatureFlag(CAPABILITY)
	bothThings() {
		return 'both';
	}
}

/** Stated once, the way every kernel resolver states it. */
@FeatureFlag(FEATURE_GRAPHQL)
class OneCodeResolver {
	things() {
		return [];
	}
}

/** States nothing at all. */
class UngatedResolver {
	things() {
		return [];
	}
}

/** The guard over a cache and a feature service whose answers the case decides. */
function gate(enabled: readonly FeatureEnum[]) {
	const entries = new Map<string, boolean>();
	const cache = {
		get: jest.fn(async (key: string) => entries.get(key)),
		set: jest.fn(async (key: string, value: boolean) => {
			entries.set(key, value);
		}),
		del: jest.fn(async (key: string) => entries.delete(key))
	};
	const featureService = { isFeatureEnabled: jest.fn(async (flag: FeatureEnum) => enabled.includes(flag)) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService,
		cache
	};
}

/** A GraphQL execution context for one field of a resolver class. */
function graphqlContext(resolver: Function, field: string): ExecutionContext {
	return {
		getHandler: () => resolver.prototype[field],
		getClass: () => resolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

/** An HTTP execution context for one route of a controller class. */
function httpContext(controller: Function, handler: string): ExecutionContext {
	return {
		getHandler: () => controller.prototype[handler],
		getClass: () => controller,
		getType: () => 'http',
		switchToHttp: () => ({ getRequest: () => ({ method: 'POST', url: `/things/${handler}` }) })
	} as unknown as ExecutionContext;
}

/** The refusal a guard raised, or undefined when it let the request through. */
async function refusal(guard: FeatureFlagGuard, context: ExecutionContext): Promise<unknown> {
	return guard.canActivate(context).then(
		() => undefined,
		(thrown) => thrown
	);
}

describe('FeatureFlagGuard — every declared code is required', () => {
	describe('two codes on one class', () => {
		it('keeps both codes, in the order the class states them', () => {
			expect(Reflect.getMetadata(FEATURE_METADATA, TwoCodeResolver)).toEqual([FEATURE_GRAPHQL, CAPABILITY]);
		});

		it('refuses a field when the capability is off even though the endpoint is on', async () => {
			// The defect itself: the capability's code was overwritten by the endpoint's, so this call was
			// let through with the capability switched off.
			const { guard, featureService } = gate([FEATURE_GRAPHQL]);

			const thrown = await refusal(guard, graphqlContext(TwoCodeResolver, 'refundThing'));

			expect(thrown).toBeInstanceOf(NotFoundException);
			expect((thrown as Error).message).toContain('refundThing');
			expect(featureService.isFeatureEnabled.mock.calls.map(([flag]) => flag)).toEqual([FEATURE_GRAPHQL, CAPABILITY]);
		});

		it('refuses a field when the endpoint is off, without resolving the codes after it', async () => {
			const { guard, featureService } = gate([CAPABILITY]);

			expect(await refusal(guard, graphqlContext(TwoCodeResolver, 'refundThing'))).toBeInstanceOf(NotFoundException);
			expect(featureService.isFeatureEnabled.mock.calls.map(([flag]) => flag)).toEqual([FEATURE_GRAPHQL]);
		});

		it('serves a field when both codes are on', async () => {
			const { guard } = gate([FEATURE_GRAPHQL, CAPABILITY]);

			await expect(guard.canActivate(graphqlContext(TwoCodeResolver, 'refundThing'))).resolves.toBe(true);
		});

		it('refuses an HTTP route the same way, naming the route', async () => {
			const { guard } = gate([FEATURE_GRAPHQL]);

			const thrown = await refusal(guard, httpContext(TwoCodeResolver, 'refundThing'));

			expect(thrown).toBeInstanceOf(NotFoundException);
			expect((thrown as Error).message).toBe('Cannot POST /things/refundThing');
		});

		it('caches each code under its own key, so a shared code is resolved once per scope', async () => {
			const { guard, featureService, cache } = gate([FEATURE_GRAPHQL, CAPABILITY]);

			await guard.canActivate(graphqlContext(TwoCodeResolver, 'refundThing'));
			await guard.canActivate(graphqlContext(OneCodeResolver, 'things'));

			expect(cache.set.mock.calls.map(([key]) => key)).toEqual([
				featureFlagCacheKey(FEATURE_GRAPHQL),
				featureFlagCacheKey(CAPABILITY)
			]);
			// The second class's code was already cached by the first class's read.
			expect(featureService.isFeatureEnabled).toHaveBeenCalledTimes(2);
		});
	});

	describe('a handler that states its own codes', () => {
		it('is gated on its own code instead of the class’s', async () => {
			// The class's capability is off, and it does not matter: the handler's own statement replaces
			// the class's, which is what a handler-level `@FeatureFlag` has always meant.
			const { guard, featureService } = gate([HANDLER_CODE]);

			await expect(guard.canActivate(graphqlContext(TwoCodeResolver, 'estimateThing'))).resolves.toBe(true);
			expect(featureService.isFeatureEnabled.mock.calls.map(([flag]) => flag)).toEqual([HANDLER_CODE]);
		});

		it('is refused when its own code is off even though the class’s codes are on', async () => {
			const { guard } = gate([FEATURE_GRAPHQL, CAPABILITY]);

			expect(await refusal(guard, graphqlContext(TwoCodeResolver, 'estimateThing'))).toBeInstanceOf(
				NotFoundException
			);
		});

		it('requires every code it stacks', async () => {
			expect(Reflect.getMetadata(FEATURE_METADATA, TwoCodeResolver.prototype.bothThings)).toEqual([
				HANDLER_CODE,
				CAPABILITY
			]);

			expect(await refusal(gate([HANDLER_CODE]).guard, graphqlContext(TwoCodeResolver, 'bothThings'))).toBeInstanceOf(
				NotFoundException
			);
			await expect(
				gate([HANDLER_CODE, CAPABILITY]).guard.canActivate(graphqlContext(TwoCodeResolver, 'bothThings'))
			).resolves.toBe(true);
		});
	});

	describe('one code, as every kernel resolver states it', () => {
		it('stores the bare code, exactly as before', () => {
			expect(Reflect.getMetadata(FEATURE_METADATA, OneCodeResolver)).toBe(FEATURE_GRAPHQL);
		});

		it('serves the field when the code is on and refuses it when it is off', async () => {
			await expect(gate([FEATURE_GRAPHQL]).guard.canActivate(graphqlContext(OneCodeResolver, 'things'))).resolves.toBe(
				true
			);

			const thrown = await refusal(gate([]).guard, graphqlContext(OneCodeResolver, 'things'));
			expect(thrown).toBeInstanceOf(NotFoundException);
			expect((thrown as Error).message).toBe('Cannot query field things');
		});
	});

	describe('no code at all', () => {
		it('refuses, without resolving an undefined code', async () => {
			const { guard, featureService } = gate([FEATURE_GRAPHQL, CAPABILITY, HANDLER_CODE]);

			expect(await refusal(guard, graphqlContext(UngatedResolver, 'things'))).toBeInstanceOf(NotFoundException);
			expect(await refusal(guard, httpContext(UngatedResolver, 'things'))).toBeInstanceOf(NotFoundException);
			expect(featureService.isFeatureEnabled).not.toHaveBeenCalled();
		});
	});
});
