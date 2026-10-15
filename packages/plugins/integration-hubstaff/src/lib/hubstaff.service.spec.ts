import { IntegrationMapSyncTimeSlotCommand } from '@gauzy/core';
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
