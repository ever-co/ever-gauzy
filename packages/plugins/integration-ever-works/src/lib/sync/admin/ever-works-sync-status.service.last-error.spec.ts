import { EverWorksSyncStatusService } from './ever-works-sync-status.service';

/**
 * The status view names the mapping's newest error log line. The lookup orders by `createdAt` then `id` and reads
 * its answer through `getOne`, which keeps the first row of whatever the query returns: without a row limit every
 * error line of the mapping came back for the one that was shown. The query now asks for one row.
 */
describe('EverWorksSyncStatusService.lastError', () => {
	const NEWEST = {
		id: 'log-newest',
		createdAt: new Date('2026-11-07T10:00:00.000Z'),
		direction: 'outbound',
		entityType: 'task',
		action: 'push',
		message: 'Ever Works answered 502'
	};
	const context = {
		tenantId: 'tenant-1',
		integrationTenantId: 'integration-1',
		organizationId: 'org-1',
		connection: { id: 'connection-1' }
	};

	/** A query builder that records its calls and answers `row` from `getOne`. */
	function recordingQuery(calls: unknown[][], row: unknown) {
		const record =
			(name: string) =>
			(...args: unknown[]) => {
				calls.push([name, ...args]);
				return query;
			};
		const query: any = {
			where: record('where'),
			andWhere: record('andWhere'),
			orderBy: record('orderBy'),
			addOrderBy: record('addOrderBy'),
			limit: record('limit'),
			getOne: jest.fn(async () => row)
		};
		return query;
	}

	function build(row: unknown) {
		const calls: unknown[][] = [];
		const query = recordingQuery(calls, row);
		const service: EverWorksSyncStatusService = Object.create(EverWorksSyncStatusService.prototype);
		Object.assign(service, { dataSource: { getRepository: () => ({ createQueryBuilder: () => query }) } });
		return { service: service as any, calls, query };
	}

	it('reads one row, the newest by createdAt then id, and shows it', async () => {
		const { service, calls, query } = build(NEWEST);

		const shown = await service.lastError(context);

		expect(shown).toEqual({
			at: NEWEST.createdAt,
			direction: 'outbound',
			entityType: 'task',
			action: 'push',
			message: 'Ever Works answered 502'
		});
		const names = calls.map(([name]) => name);
		// CONTROL: the ordering that makes "first row" mean "newest" is still there
		expect(calls).toContainEqual(['orderBy', 'log.createdAt', 'DESC']);
		expect(calls).toContainEqual(['addOrderBy', 'log.id', 'DESC']);
		expect(calls).toContainEqual(['limit', 1]);
		expect(names.indexOf('limit')).toBeGreaterThan(names.indexOf('addOrderBy'));
		expect(query.getOne).toHaveBeenCalledTimes(1);
	});

	it('answers null when the mapping has no error line', async () => {
		const { service } = build(null);
		expect(await service.lastError(context)).toBeNull();
	});
});
