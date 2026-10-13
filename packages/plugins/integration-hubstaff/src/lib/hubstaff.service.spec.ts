import { IntegrationMapSyncTimeSlotCommand } from '@gauzy/core';
import { HubstaffService } from './hubstaff.service';

/**
 * `syncTimeSlots` used `timeSlots.filter(async (slot) => …)`: the callback returns a promise, which is always
 * truthy, so every slot was kept whatever its mapping gave, and the mappings were still running (unawaited,
 * their rejections unhandled) when the time log was saved with the slots.
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

	it('drops only the slots whose mapping failed or gave nothing, without an unhandled rejection', async () => {
		const execute = jest
			.fn()
			.mockResolvedValueOnce({ id: 'map-1' })
			.mockRejectedValueOnce(new Error('mapping failed'))
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: 'map-4' });
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const result = await setup(execute)([slot(1), slot(2), slot(3), slot(4)]);
		// Give a stray rejection the chance to surface
		await new Promise((resolve) => setImmediate(resolve));

		expect(result).toEqual([synced(1), synced(4)]);
		expect(unhandled).toEqual([]);
		error.mockRestore();
	});
});
