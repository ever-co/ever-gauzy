import { ConflictException, Logger } from '@nestjs/common';
import { FindOperator, IsNull, LessThan, Not } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { ASANA_IMPORT_SWEEP_BATCH, ASANA_IMPORT_SWEEP_SLACK_MS, ASANA_IMPORT_WEBHOOK_STRIDE } from '../asana.constants';
import { AsanaConfig } from '../asana-config';
import { AsanaSyncRunService } from '../asana-sync-run.service';
import { AsanaTenantService } from '../asana-tenant.service';
import { AsanaProjectMapping, AsanaSyncDirection, TypeOrmAsanaProjectMappingRepository } from '../entities/asana-project-mapping.entity';
import { AsanaSyncService } from '../sync/asana-sync.service';
import { AsanaImportSweepService } from './asana-import-sweep.service';

const now = new Date('2026-11-07T12:00:00.000Z');

/** A due mapping of one connection (`int-<tenant>`), in its tenant and organization. */
function mappingOf(id: string, tenantId = 'tenant-1', organizationId = 'org-1'): AsanaProjectMapping {
	return { id, tenantId, organizationId, integrationId: `int-${tenantId}`, syncEnabled: true, direction: AsanaSyncDirection.INBOUND } as unknown as AsanaProjectMapping;
}

/** The sweep over doubles: a scripted repository, connection lookup, claim and import. */
function sweep(config: Partial<AsanaConfig> = {}) {
	const find = jest.fn().mockResolvedValue([]);
	let lastListed: AsanaProjectMapping[] = [];
	const tenantsSeen: Array<string | null | undefined> = [];
	/** What the re-read answers for a mapping when the test says so (null = removed); the listed one otherwise. */
	const findOneAnswers = new Map<string, AsanaProjectMapping | null>();
	const findOne = jest.fn(async ({ where }: { where: { id: string } }) => {
		// The re-read happens inside the mapping's own tenant context.
		tenantsSeen.push(RequestContext.currentTenantId());
		if (findOneAnswers.has(where.id)) return findOneAnswers.get(where.id);
		return lastListed.find((mapping) => mapping.id === where.id) ?? null;
	});
	const attention = new Set<string>();
	const gone = new Set<string>();
	const findAnyById = jest.fn(async (integrationId: string) =>
		gone.has(integrationId) ? null : { id: integrationId, tenantId: integrationId.replace('int-', ''), organizationId: 'org-1', settings: [] }
	);
	const ensureAttentionFiled = jest.fn(async (_tenant: { id: string }) => undefined);
	const findRefusedUnfiled = jest.fn(async () => [] as Array<{ id: string }>);
	const summaryOf = jest.fn((tenant: { id: string }) => ({ attentionReason: attention.has(tenant.id) ? 'token_refused' : null }));
	const claimImport = jest.fn(async (_tenant: unknown, mapping: AsanaProjectMapping, _input: { full?: boolean; requestedByUserId?: string | null }) => ({ id: `run-${mapping.id}`, mappingId: mapping.id }));
	const importMapping = jest.fn().mockResolvedValue(undefined);
	const service = new AsanaImportSweepService(
		{ find, findOne } as unknown as TypeOrmAsanaProjectMappingRepository,
		{ findAnyById, summaryOf, ensureAttentionFiled, findRefusedUnfiled } as unknown as AsanaTenantService,
		{ claimImport } as unknown as AsanaSyncRunService,
		{ importMapping } as unknown as AsanaSyncService,
		{ importIntervalMinutes: 15, ...config } as AsanaConfig
	);
	const list = (mappings: AsanaProjectMapping[]) => {
		lastListed = mappings;
		find.mockResolvedValue(mappings);
	};
	return { service, find, findOne, findOneAnswers, list, findAnyById, summaryOf, ensureAttentionFiled, findRefusedUnfiled, attention, gone, claimImport, importMapping, tenantsSeen };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('AsanaImportSweepService', () => {
	it('files again the notice of a refused connection whose filing did not get through — first, and whatever its mappings', async () => {
		const { service, list, findRefusedUnfiled, ensureAttentionFiled } = sweep();
		findRefusedUnfiled.mockResolvedValue([{ id: 'int-tenant-9' }]);
		list([]);
		const outcome = await service.run();
		expect(ensureAttentionFiled).toHaveBeenCalledWith(expect.objectContaining({ id: 'int-tenant-9' }));
		expect(outcome.attention).toBe(1);
	});

	it('does nothing at all when the interval is 0', async () => {
		const { service, find } = sweep({ importIntervalMinutes: 0 });
		expect(await service.run(now)).toEqual({ attention: 0, due: 0, imported: 0, skipped: 0, failed: 0 });
		expect(find).not.toHaveBeenCalled();
	});

	it('reads every inbound mapping that is due: never imported, or older than the interval — four intervals with a live webhook', async () => {
		const { service, find } = sweep();
		await service.findDue(now);
		expect(find).toHaveBeenCalledTimes(1);
		const query = find.mock.calls[0][0] as { where: Array<Record<string, FindOperator<unknown>>>; order: unknown; take?: number };
		expect(query.take).toBeUndefined();
		expect(query.order).toBeUndefined();
		expect(query.where).toHaveLength(3);
		for (const branch of query.where) {
			expect(branch['syncEnabled']).toBe(true);
			expect(branch['direction']).toEqual(Not(AsanaSyncDirection.OUTBOUND));
		}
		expect(query.where[0]['lastImportedAt']).toEqual(IsNull());
		expect(query.where[1]['webhookGid']).toEqual(IsNull());
		expect(query.where[1]['lastImportedAt']).toEqual(LessThan(new Date(now.getTime() - 15 * 60_000 + ASANA_IMPORT_SWEEP_SLACK_MS)));
		expect(query.where[2]['webhookGid']).toEqual(Not(IsNull()));
		expect(query.where[2]['lastImportedAt']).toEqual(LessThan(new Date(now.getTime() - 15 * ASANA_IMPORT_WEBHOOK_STRIDE * 60_000 + ASANA_IMPORT_SWEEP_SLACK_MS)));
	});

	it('imports each due mapping in its own tenant context, as it is at claim time, with the claim "import now" takes and no requesting user', async () => {
		const { service, list, findAnyById, claimImport, importMapping, tenantsSeen } = sweep();
		list([mappingOf('m-1', 'tenant-1'), mappingOf('m-2', 'tenant-2')]);

		expect(await service.run(now)).toEqual({ attention: 0, due: 2, imported: 2, skipped: 0, failed: 0 });

		expect(findAnyById.mock.calls.map((call) => call[0])).toEqual(['int-tenant-1', 'int-tenant-2']);
		expect(tenantsSeen).toEqual(['tenant-1', 'tenant-2']);
		expect(claimImport).toHaveBeenCalledTimes(2);
		expect(claimImport.mock.calls[0][2]).toEqual({ full: false, requestedByUserId: null });
		expect(importMapping).toHaveBeenCalledTimes(2);
		expect(importMapping.mock.calls[1][1].id).toBe('m-2');
		expect(importMapping.mock.calls[1][2]).toEqual({ id: 'run-m-2', mappingId: 'm-2' });
	});

	it('takes the mappings of a gone or refused connection out before the batch is cut, so they never hold the front of the queue', async () => {
		const { service, list, attention, gone, findAnyById, importMapping } = sweep();
		const refused = Array.from({ length: ASANA_IMPORT_SWEEP_BATCH }, (_, index) => mappingOf(`r-${index}`, 'refused'));
		list([...refused, mappingOf('g-1', 'gone'), mappingOf('fine', 'healthy')]);
		attention.add('int-refused');
		gone.add('int-gone');

		expect(await service.run(now)).toEqual({ attention: 0, due: 1, imported: 1, skipped: 0, failed: 0 });
		// Each connection is read once, whatever its number of mappings.
		expect(findAnyById).toHaveBeenCalledTimes(3);
		expect(importMapping).toHaveBeenCalledTimes(1);
		expect(importMapping.mock.calls[0][1].id).toBe('fine');
	});

	it('imports at most one batch per sweep, the longest waiting first — a mapping never imported before any other, whatever the database listed first', async () => {
		const { service, list, importMapping } = sweep();
		const imported = Array.from({ length: ASANA_IMPORT_SWEEP_BATCH + 5 }, (_, index) => ({ ...mappingOf(`m-${index}`), lastImportedAt: new Date(now.getTime() - (index + 1) * 3_600_000) }));
		// Listed last, as PostgreSQL lists a null on an ascending order.
		list([...imported, { ...mappingOf('never'), lastImportedAt: null }]);

		expect(await service.run(now)).toMatchObject({ due: ASANA_IMPORT_SWEEP_BATCH, imported: ASANA_IMPORT_SWEEP_BATCH });
		expect(importMapping.mock.calls[0][1].id).toBe('never');
		expect(importMapping.mock.calls[1][1].id).toBe(`m-${ASANA_IMPORT_SWEEP_BATCH + 4}`);
	});

	it('leaves alone a mapping whose import is running, and one switched off, turned outbound or removed since it was listed', async () => {
		const { service, list, findOneAnswers, claimImport, importMapping } = sweep();
		list([mappingOf('running'), mappingOf('off'), mappingOf('outbound'), mappingOf('removed'), mappingOf('fine')]);
		claimImport.mockImplementation(async (_tenant: unknown, mapping: AsanaProjectMapping, _input: { full?: boolean; requestedByUserId?: string | null }) => {
			if (mapping.id === 'running') throw new ConflictException('An import of this mapping is running');
			return { id: `run-${mapping.id}`, mappingId: mapping.id };
		});
		findOneAnswers.set('off', { ...mappingOf('off'), syncEnabled: false });
		findOneAnswers.set('outbound', { ...mappingOf('outbound'), direction: AsanaSyncDirection.OUTBOUND });
		findOneAnswers.set('removed', null);

		expect(await service.run(now)).toEqual({ attention: 0, due: 5, imported: 1, skipped: 4, failed: 0 });
		expect(claimImport).toHaveBeenCalledTimes(2);
		expect(importMapping).toHaveBeenCalledTimes(1);
		expect(importMapping.mock.calls[0][1].id).toBe('fine');
	});

	it('reports a mapping whose import could not start and goes on with the next', async () => {
		const { service, list, claimImport, importMapping } = sweep();
		list([mappingOf('broken'), mappingOf('fine')]);
		claimImport.mockImplementationOnce(async () => {
			throw new Error('connection lost');
		});

		expect(await service.run(now)).toEqual({ attention: 0, due: 2, imported: 1, skipped: 0, failed: 1 });
		expect(importMapping).toHaveBeenCalledTimes(1);
		expect(importMapping.mock.calls[0][1].id).toBe('fine');
	});
});
