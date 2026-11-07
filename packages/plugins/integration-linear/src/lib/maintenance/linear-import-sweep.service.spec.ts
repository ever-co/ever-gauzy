import { ConflictException, Logger } from '@nestjs/common';
import { FindOperator, IsNull, LessThan, Not } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { LINEAR_IMPORT_SWEEP_BATCH, LINEAR_IMPORT_SWEEP_SLACK_MS, LINEAR_IMPORT_WEBHOOK_STRIDE } from '../linear.constants';
import { LinearConfig } from '../linear-config';
import { LinearSyncRunService } from '../linear-sync-run.service';
import { LinearTenantService } from '../linear-tenant.service';
import { LinearTeamMapping, LinearSyncDirection, TypeOrmLinearTeamMappingRepository } from '../entities/linear-team-mapping.entity';
import { LinearSyncService } from '../sync/linear-sync.service';
import { LinearImportSweepService } from './linear-import-sweep.service';

const now = new Date('2026-11-07T12:00:00.000Z');

/** A due mapping of one tenant and organization. */
function mappingOf(id: string, tenantId = 'tenant-1', organizationId = 'org-1'): LinearTeamMapping {
	return { id, tenantId, organizationId, integrationId: `int-${tenantId}`, syncEnabled: true, direction: LinearSyncDirection.INBOUND } as unknown as LinearTeamMapping;
}

/** The sweep over doubles: a scripted repository, connection lookup, claim and import. */
function sweep(config: Partial<LinearConfig> = {}) {
	const find = jest.fn().mockResolvedValue([]);
	const tenantsSeen: Array<string | undefined> = [];
	const requireById = jest.fn(async (integrationId: string) => {
		// The lookup reads the tenant from the request context: the sweep must have opened the mapping's own.
		tenantsSeen.push(RequestContext.currentTenantId());
		return { id: integrationId, tenantId: integrationId.replace('int-', ''), organizationId: 'org-1', settings: [] };
	});
	const summaryOf = jest.fn(() => ({ attentionReason: null }));
	const claimImport = jest.fn(async (_tenant: unknown, mapping: LinearTeamMapping, _input: { full?: boolean; requestedByUserId?: string | null }) => ({ id: `run-${mapping.id}`, mappingId: mapping.id }));
	const importMapping = jest.fn().mockResolvedValue(undefined);
	const service = new LinearImportSweepService(
		{ find } as unknown as TypeOrmLinearTeamMappingRepository,
		{ requireById, summaryOf } as unknown as LinearTenantService,
		{ claimImport } as unknown as LinearSyncRunService,
		{ importMapping } as unknown as LinearSyncService,
		{ importIntervalMinutes: 15, webhookSecret: null, ...config } as LinearConfig
	);
	return { service, find, requireById, summaryOf, claimImport, importMapping, tenantsSeen };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('LinearImportSweepService', () => {
	it('does nothing at all when the interval is 0', async () => {
		const { service, find } = sweep({ importIntervalMinutes: 0 });
		expect(await service.run(now)).toEqual({ due: 0, imported: 0, skipped: 0, failed: 0 });
		expect(find).not.toHaveBeenCalled();
	});

	it('reads the inbound mappings that are due: never imported, or older than the interval — four intervals when the application takes webhooks', async () => {
		const { service, find } = sweep();
		await service.findDue(now);
		expect(find).toHaveBeenCalledTimes(1);
		const query = find.mock.calls[0][0] as { where: Array<Record<string, FindOperator<unknown>>>; order: unknown; take: number };
		expect(query.take).toBe(LINEAR_IMPORT_SWEEP_BATCH);
		expect(query.order).toEqual({ lastImportedAt: 'ASC' });
		expect(query.where).toHaveLength(2);
		for (const branch of query.where) {
			expect(branch['syncEnabled']).toBe(true);
			expect(branch['direction']).toEqual(Not(LinearSyncDirection.OUTBOUND));
		}
		expect(query.where[0]['lastImportedAt']).toEqual(IsNull());
		expect(query.where[1]['lastImportedAt']).toEqual(LessThan(new Date(now.getTime() - 15 * 60_000 + LINEAR_IMPORT_SWEEP_SLACK_MS)));

		const withWebhooks = sweep({ webhookSecret: 's' });
		await withWebhooks.service.findDue(now);
		const reconcile = withWebhooks.find.mock.calls[0][0] as { where: Array<Record<string, FindOperator<unknown>>> };
		expect(reconcile.where[1]['lastImportedAt']).toEqual(LessThan(new Date(now.getTime() - 15 * LINEAR_IMPORT_WEBHOOK_STRIDE * 60_000 + LINEAR_IMPORT_SWEEP_SLACK_MS)));
	});

	it('imports each due mapping in its own tenant context, with the claim "import now" takes and no requesting user', async () => {
		const { service, find, requireById, claimImport, importMapping, tenantsSeen } = sweep();
		find.mockResolvedValue([mappingOf('m-1', 'tenant-1'), mappingOf('m-2', 'tenant-2')]);

		expect(await service.run(now)).toEqual({ due: 2, imported: 2, skipped: 0, failed: 0 });

		expect(requireById.mock.calls.map((call) => call[0])).toEqual(['int-tenant-1', 'int-tenant-2']);
		expect(tenantsSeen).toEqual(['tenant-1', 'tenant-2']);
		expect(claimImport).toHaveBeenCalledTimes(2);
		expect(claimImport.mock.calls[0][2]).toEqual({ full: false, requestedByUserId: null });
		expect(importMapping).toHaveBeenCalledTimes(2);
		expect(importMapping.mock.calls[1][1].id).toBe('m-2');
		expect(importMapping.mock.calls[1][2]).toEqual({ id: 'run-m-2', mappingId: 'm-2' });
	});

	it('leaves alone a mapping whose import is running, whose connection is gone, or whose connection waits for a person', async () => {
		const { service, find, requireById, summaryOf, claimImport, importMapping } = sweep();
		find.mockResolvedValue([mappingOf('running'), mappingOf('gone'), mappingOf('refused'), mappingOf('fine')]);
		claimImport.mockImplementation(async (_tenant: unknown, mapping: LinearTeamMapping, _input: { full?: boolean; requestedByUserId?: string | null }) => {
			if (mapping.id === 'running') throw new ConflictException('An import of this mapping is running');
			return { id: `run-${mapping.id}`, mappingId: mapping.id };
		});
		let call = 0;
		requireById.mockImplementation(async (integrationId: string) => {
			call += 1;
			if (call === 2) throw new Error('The Linear connection was not found');
			return { id: integrationId, tenantId: 'tenant-1', organizationId: 'org-1', settings: [] };
		});
		summaryOf.mockImplementation(() => ({ attentionReason: call === 3 ? 'token_refused' : null }));

		expect(await service.run(now)).toEqual({ due: 4, imported: 1, skipped: 3, failed: 0 });
		expect(importMapping).toHaveBeenCalledTimes(1);
		expect(importMapping.mock.calls[0][1].id).toBe('fine');
	});

	it('reports a mapping whose import could not start and goes on with the next', async () => {
		const { service, find, claimImport, importMapping } = sweep();
		find.mockResolvedValue([mappingOf('broken'), mappingOf('fine')]);
		claimImport.mockImplementationOnce(async () => {
			throw new Error('connection lost');
		});

		expect(await service.run(now)).toEqual({ due: 2, imported: 1, skipped: 0, failed: 1 });
		expect(importMapping).toHaveBeenCalledTimes(1);
		expect(importMapping.mock.calls[0][1].id).toBe('fine');
	});
});
