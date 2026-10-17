import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { IntegrationMapSyncTimeSlotCommand, IntegrationTenantSyncService, RequestContext } from '@gauzy/core';
import { HubstaffService, hubstaffSyncCounts } from './hubstaff.service';

/**
 * `syncTimeSlots` used `timeSlots.filter(async (slot) => …)`: the callback returns a promise, which is always
 * truthy, so the mappings were still running (unawaited, their rejections unhandled) when the time log was saved
 * with the slots.
 */
describe('HubstaffService.syncTimeSlots', () => {
	const slot = (id: number) => ({
		id,
		keyboard: id,
		mouse: id * 2,
		overall: id * 3,
		tracked: 600,
		time_slot: `2026-10-12T10:${id}0:00Z`
	});
	const synced = (id: number) => ({
		keyboard: id,
		mouse: id * 2,
		overall: id * 3,
		duration: 600,
		startedAt: `2026-10-12T10:${id}0:00Z`
	});

	const setup = (execute: jest.Mock) => {
		// Only the command bus is used by this method; the other collaborators are not reached
		const service = new HubstaffService(
			{} as never,
			{ execute } as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		);
		return (slots: ReturnType<typeof slot>[]) =>
			service.syncTimeSlots('integration-1', 'org-1', { gauzyId: 'employee-1' } as never, slots as never);
	};

	let unhandled: unknown[];
	const onUnhandled = (reason: unknown) => unhandled.push(reason);

	beforeEach(() => {
		unhandled = [];
		process.on('unhandledRejection', onUnhandled);
	});

	afterEach(() => {
		process.off('unhandledRejection', onUnhandled);
	});

	it('maps every slot for the employee and returns them once every mapping is done', async () => {
		let finished = 0;
		const execute = jest.fn(
			() => new Promise((resolve) => setTimeout(() => resolve({ id: `map-${++finished}` }), 5))
		);

		const result = await setup(execute)([slot(1), slot(2)]);

		expect(finished).toBe(2);
		expect(execute).toHaveBeenCalledTimes(2);
		const [[command]] = execute.mock.calls as unknown as [[IntegrationMapSyncTimeSlotCommand]];
		expect(command).toBeInstanceOf(IntegrationMapSyncTimeSlotCommand);
		expect(command.input).toMatchObject({
			entity: { id: 1, employeeId: 'employee-1' },
			sourceId: '1',
			integrationId: 'integration-1',
			organizationId: 'org-1'
		});
		expect(result).toEqual([synced(1), synced(2)]);
	});

	it("logs a failed mapping, still submits every slot's activity, and leaves no unhandled rejection", async () => {
		const execute = jest
			.fn()
			.mockResolvedValueOnce({ id: 'map-1' })
			.mockRejectedValueOnce(new Error('mapping failed'))
			.mockResolvedValueOnce({ id: 'map-3' });
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const result = await setup(execute)([slot(1), slot(2), slot(3)]);
		// Give a stray rejection the chance to surface
		await new Promise((resolve) => setImmediate(resolve));

		// The mapping only records the Hubstaff slot id; the activity travels in the time log. Dropping slot 2
		// would leave a blank slot in its place, and the imported time log would never be completed later.
		expect(result).toEqual([synced(1), synced(2), synced(3)]);
		expect(error).toHaveBeenCalledTimes(1);
		expect(error.mock.calls[0][0]).toContain('2');
		expect(unhandled).toEqual([]);
		error.mockRestore();
	});
});

/**
 * `autoSync` is Hubstaff's one synchronisation entry point, and it ended without recording anything: the connection's
 * `lastSyncedAt` was never stamped and no `integration_tenant.synced` fact was appended, so
 * `Subscription.integrationSyncCompleted` had nothing to follow. A finished run now ends through
 * `IntegrationTenantSyncService.recordSyncCompleted`, with the counts of what it handled; a run that fails does not.
 */
describe('HubstaffService.autoSync — the end of a run is recorded (integrationSyncCompleted)', () => {
	const setup = (entitySettings: Array<Record<string, unknown>>) => {
		const recordSyncCompleted = jest.fn(async () => undefined);
		const service = new HubstaffService(
			{} as never,
			{} as never,
			{ findOneByIdString: jest.fn(async () => ({ entitySettings })) } as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{ recordSyncCompleted } as never
		);
		return { service, recordSyncCompleted };
	};
	const run = { integrationId: 'integration-1', gauzyId: 'org-1', sourceId: 'hs-org', token: 'token', dateRange: {} as never };

	it('records a finished run once, for the organization it synchronised into, with what it handled', async () => {
		const { service, recordSyncCompleted } = setup([{ entity: 'Client', tiedEntities: [] }]);
		jest.spyOn(service as any, '_handleClients').mockResolvedValue([{ id: 'map-1' }, { id: 'map-2' }]);

		await service.autoSync(run);

		expect(recordSyncCompleted).toHaveBeenCalledTimes(1);
		expect(recordSyncCompleted).toHaveBeenCalledWith('integration-1', { organizationId: 'org-1', counts: { client: 2 } });
	});

	it('records nothing for a run that failed', async () => {
		const { service, recordSyncCompleted } = setup([{ entity: 'Client', tiedEntities: [] }]);
		jest.spyOn(service as any, '_handleClients').mockRejectedValue(new Error('Hubstaff is unavailable'));

		await expect(service.autoSync(run)).rejects.toThrow(/Hubstaff is unavailable/);

		expect(recordSyncCompleted).not.toHaveBeenCalled();
	});

	it('counts each kind flat, nested per project or not, and only counts', () => {
		expect(
			hubstaffSyncCounts([
				{ projectsMap: [{ id: 'p1' }, { id: 'p2' }], tasks: [[{ id: 't1' }], [{ id: 't2' }, { id: 't3' }]], activities: undefined },
				{ clients: [{ id: 'c1' }] },
				undefined
			])
		).toEqual({ project: 2, task: 3, client: 1 });
	});
});

/**
 * Recording the run is its epilogue, never part of the import.
 *
 * Hubstaff stamped nothing before `integrationSyncCompleted`, so a recording that cannot be made must not turn an
 * import that ran into a failed one. The cases run the kernel's real `IntegrationTenantSyncService` over a connection
 * table double, with a request context of a real CLS store:
 *
 * - Hubstaff maps each of its organizations to ANY Gauzy organization (`gauzyId`), which need not be the connection's
 *   own; the recording finds the connection by its id within the tenant and announces it in the connection's own
 *   organization, so a run into another organization is recorded — and was refused with `NotFoundException` after
 *   the import had already run, while the recording narrowed its lookup by the run's organization;
 * - a run with no tenant in its context cannot be recorded (the recording stays fail-closed), and still answers;
 * - a recording that fails outright is logged and the run still answers.
 */
describe('HubstaffService.autoSync — recording the run never fails the import (integrationSyncCompleted)', () => {
	const originalClsService = RequestContext['clsService'];
	const TENANT = 'tenant-1';
	const CONNECTION = 'integration-1';

	beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));
	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	/** The connection table and outbox the real recording service writes, with the connection in its own organization. */
	const store = () => {
		const rows = [{ id: CONNECTION, name: 'HUBSTAFF', tenantId: TENANT, organizationId: 'org-of-the-connection', lastSyncedAt: null }];
		const facts: Array<Record<string, any>> = [];
		const matches = (row: Record<string, any>, where: Record<string, any>) =>
			Object.entries(where).every(([field, value]) => value === undefined || String(row[field]) === String(value));
		const manager = {
			findOne: async (_entity: unknown, { where }: { where: Record<string, any> }) => rows.find((row) => matches(row, where)) ?? null,
			update: async (_entity: unknown, where: Record<string, any>, patch: Record<string, any>) => {
				rows.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, patch));
			}
		};
		const recording = new IntegrationTenantSyncService(
			{ manager: { transaction: async (work: (m: unknown) => Promise<unknown>) => await work(manager) } } as never,
			{} as never,
			{ append: async (_manager: unknown, fact: Record<string, any>) => facts.push(fact) } as never,
			{} as never
		);
		return { rows, facts, recording };
	};

	const serviceWith = (recording: unknown) => {
		const service = new HubstaffService(
			{} as never,
			{} as never,
			{ findOneByIdString: jest.fn(async () => ({ entitySettings: [{ entity: 'Client', tiedEntities: [] }] })) } as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			recording as never
		);
		jest.spyOn(service as any, '_handleClients').mockResolvedValue([{ id: 'map-1' }]);
		return service;
	};
	const run = { integrationId: CONNECTION, gauzyId: 'org-the-run-synced-into', sourceId: 'hs-org', token: 'token', dateRange: {} as never };
	const asTenant = <T>(work: () => T): T =>
		RequestContext.runWithRequest({ user: { id: 'user-1', tenantId: TENANT } } as never, work);

	it('a Hubstaff run into an organization other than the connection’s still answers its results, and is recorded on the connection', async () => {
		const db = store();

		await expect(asTenant(() => serviceWith(db.recording).autoSync(run))).resolves.toEqual([{ clients: [{ id: 'map-1' }] }]);

		expect(db.rows[0].lastSyncedAt).toBeInstanceOf(Date);
		expect(db.facts).toEqual([
			expect.objectContaining({
				name: 'integration_tenant.synced',
				aggregateId: CONNECTION,
				tenantId: TENANT,
				organizationId: 'org-of-the-connection',
				data: expect.objectContaining({ counts: { client: 1 } })
			})
		]);
	});

	it('a run with no tenant in its context still answers its results, and records nothing', async () => {
		const db = store();

		await expect(serviceWith(db.recording).autoSync(run)).resolves.toEqual([{ clients: [{ id: 'map-1' }] }]);

		expect(db.rows[0].lastSyncedAt).toBeNull();
		expect(db.facts).toEqual([]);
	});

	it('a recording that fails is logged, and the run still answers its results', async () => {
		const recordSyncCompleted = jest.fn(async () => {
			throw new Error('the outbox is unavailable');
		});
		const warn = jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation(() => undefined);

		await expect(serviceWith({ recordSyncCompleted }).autoSync(run)).resolves.toEqual([{ clients: [{ id: 'map-1' }] }]);

		expect(recordSyncCompleted).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining(CONNECTION));
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('the outbox is unavailable'));
		warn.mockRestore();
	});
});
