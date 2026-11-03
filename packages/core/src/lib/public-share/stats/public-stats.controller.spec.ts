/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service (see the note at the top of
 * `screenshot.controller.spec.ts`).
 */
import '../../core/entities/internal';
import { GUARDS_METADATA, INTERCEPTORS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { FEATURE_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { FeatureEnum } from '@gauzy/contracts';
import { StatsGuard } from '../../stats/stats.guard';
import { PublicTransformInterceptor } from '../public-transform.interceptor';
import { PublicStatsController } from './public-stats.controller';
import { PublicStatsService } from './public-stats.service';
import { PublicStats } from './public-stats.types';

/**
 * The route's contract is in its decorators: anyone may call it, the installation's `FEATURE_OPEN_STATS`
 * switch gates it (through `StatsGuard`, a 404 when off), the throttler budgets it per address, and the
 * answer is cacheable for the service's own window.
 */
describe('PublicStatsController', () => {
	const handler = PublicStatsController.prototype.getPublicStats;

	const stats: PublicStats = {
		tenants: 5458,
		tenantsLast90Days: 660,
		users: 5103,
		employees: 3858,
		teams: 2033,
		projects: 2404,
		screenshots: 1909960,
		hoursTracked: 183349,
		computedAt: '2026-11-03T21:00:00.000Z'
	};

	/** The controller over a service that answers `stats` and the given `Cache-Control`. */
	async function build(cacheControl: string) {
		const getPublicStats = jest.fn(async () => stats);
		const module = await Test.createTestingModule({
			controllers: [PublicStatsController],
			providers: [{ provide: PublicStatsService, useValue: { getPublicStats, cacheControl } }]
		}).compile();
		const response = { setHeader: jest.fn() };
		return { controller: module.get(PublicStatsController), getPublicStats, response };
	}

	it('is mounted at GET /public/stats', () => {
		expect(Reflect.getMetadata(PATH_METADATA, PublicStatsController)).toBe('/public/stats');
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/');
	});

	it('is public, and gated on FEATURE_OPEN_STATS like GET /stats/global', () => {
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, PublicStatsController)).toBe(true);
		expect(Reflect.getMetadata(FEATURE_METADATA, PublicStatsController)).toBe(FeatureEnum.FEATURE_OPEN_STATS);
		expect(Reflect.getMetadata(GUARDS_METADATA, PublicStatsController)).toContain(StatsGuard);
		expect(Reflect.getMetadata(INTERCEPTORS_METADATA, PublicStatsController)).toContain(PublicTransformInterceptor);
	});

	it('has a per-address budget of its own', () => {
		const limitKey = Reflect.getMetadataKeys(handler).find(
			(key) => typeof key === 'string' && key.startsWith('THROTTLER:LIMIT')
		);
		expect(limitKey).toBeDefined();
		expect(Reflect.getMetadata(limitKey, handler)).toBe(30);
	});

	it("answers the service's counts as they are, cacheable for the service's own window", async () => {
		const { controller, getPublicStats, response } = await build(
			'public, max-age=3600, stale-while-revalidate=600'
		);

		await expect(controller.getPublicStats(response as any)).resolves.toEqual(stats);
		expect(getPublicStats).toHaveBeenCalledTimes(1);
		expect(response.setHeader).toHaveBeenCalledWith(
			'Cache-Control',
			'public, max-age=3600, stale-while-revalidate=600'
		);
	});

	it('forbids caching when the service recounts on every call', async () => {
		const { controller, response } = await build('no-store');

		await controller.getPublicStats(response as any);
		expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
	});
});
