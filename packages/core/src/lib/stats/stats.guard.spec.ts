/**
 * `StatsGuard` against the real `@FeatureFlag` decorator and a real `Reflector`.
 *
 * The guard gates the open-statistics route and its GraphQL mirror on flags read from the environment
 * (`gauzyToggleFeatures`) rather than from the feature catalogue. Two things are pinned here: stacked
 * flags are all required, now that the decorator accumulates them, and a refusal over GraphQL is a 404
 * like the route's — it used to read `method` and `url` off a request the GraphQL transport does not
 * have, and answered a `TypeError`.
 */
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';

const mockToggles: Record<string, boolean> = {};

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	get gauzyToggleFeatures() {
		return mockToggles;
	}
}));

import { StatsGuard } from './stats.guard';

class StatsRoutes {
	@FeatureFlag(FeatureEnum.FEATURE_OPEN_STATS)
	single(): void {}

	@FeatureFlag(FeatureEnum.FEATURE_GOAL)
	@FeatureFlag(FeatureEnum.FEATURE_OPEN_STATS)
	stacked(): void {}

	unflagged(): void {}
}

/** An execution context for one handler of `StatsRoutes`, over the given transport. */
function contextFor(handler: keyof StatsRoutes, type: 'http' | 'graphql'): ExecutionContext {
	const request = { method: 'GET', url: '/api/stats/global' };

	return {
		getHandler: () => StatsRoutes.prototype[handler],
		getClass: () => StatsRoutes,
		getType: () => type,
		getArgByIndex: (index: number) => (index === 3 ? { fieldName: 'globalStats' } : undefined),
		switchToHttp: () => ({ getRequest: () => (type === 'http' ? request : undefined) })
	} as unknown as ExecutionContext;
}

describe('StatsGuard', () => {
	const guard = new StatsGuard(new Reflector());

	beforeEach(() => {
		for (const key of Object.keys(mockToggles)) delete mockToggles[key];
	});

	it('lets a request through when its one flag is switched on', async () => {
		mockToggles[FeatureEnum.FEATURE_OPEN_STATS] = true;

		await expect(guard.canActivate(contextFor('single', 'http'))).resolves.toBe(true);
	});

	it('refuses with a 404 over HTTP when the flag is off', async () => {
		await expect(guard.canActivate(contextFor('single', 'http'))).rejects.toBeInstanceOf(NotFoundException);
	});

	it('refuses with a 404 over GraphQL rather than failing to read a request that is not there', async () => {
		const refusal = guard.canActivate(contextFor('single', 'graphql'));

		await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
		await expect(guard.canActivate(contextFor('single', 'graphql'))).rejects.toThrow(/globalStats/);
	});

	it('requires every stacked flag, not whichever one was stored last', async () => {
		mockToggles[FeatureEnum.FEATURE_OPEN_STATS] = true;

		await expect(guard.canActivate(contextFor('stacked', 'http'))).rejects.toBeInstanceOf(NotFoundException);

		mockToggles[FeatureEnum.FEATURE_GOAL] = true;

		await expect(guard.canActivate(contextFor('stacked', 'http'))).resolves.toBe(true);
	});

	it('refuses a route that declares no flag, as it always has', async () => {
		await expect(guard.canActivate(contextFor('unflagged', 'http'))).rejects.toBeInstanceOf(NotFoundException);
	});
});
