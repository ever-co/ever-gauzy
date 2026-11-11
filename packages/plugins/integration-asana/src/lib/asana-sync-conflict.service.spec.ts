import { ConflictException, NotFoundException } from '@nestjs/common';
import { In, Not } from 'typeorm';
import { syncedValuesOf, TaskUpdateCommand } from '@gauzy/core';
import { AsanaSyncConflictResolution, AsanaSyncConflictStatus } from './entities/asana-sync-conflict.entity';
import { ASANA_CONFLICT_NOT_FOUND, ASANA_CONFLICT_STALE } from './asana.constants';
import { AsanaSyncConflictService, restorePatchOf } from './asana-sync-conflict.service';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
const tenant = { id: 'int-1', ...scope } as never;
/** What the Asana task and its task last agreed on. */
const agreed = syncedValuesOf({ title: 'Agreed', description: 'Body', status: 'Todo', priority: 'Low', dueDate: null });

/** The service over doubles of its two tables, the task store and the command bus. */
function harness() {
	const conflicts = {
		findOne: jest.fn(),
		find: jest.fn().mockResolvedValue([]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		save: jest.fn(async (rows: Array<Record<string, unknown>>) => rows.map((row, index) => ({ ...row, id: `c-new-${index + 1}` }))),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		manager: { findOne: jest.fn() }
	};
	const baselines = {
		findOne: jest.fn().mockResolvedValue(null),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		save: jest.fn(async (row: unknown) => row)
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
	const service = new AsanaSyncConflictService(commandBus as never, conflicts as never, baselines as never);
	return { service, conflicts, baselines, commandBus };
}

/** A task as the store answers it. */
function taskOf(fields: Record<string, unknown> = {}) {
	return { id: 'task-1', title: 'Agreed', description: 'Body', status: 'Todo', taskStatusId: 's-todo', priority: 'Low', taskPriorityId: 'p-low', dueDate: null, ...fields };
}

describe('AsanaSyncConflictService', () => {
	describe('prepare (before a Asana task is written to its task)', () => {
		it('reads nothing for a Asana task with no task yet', async () => {
			const { service, baselines, conflicts } = harness();
			expect(await service.prepare({ ...scope, integrationId: 'int-1', sourceId: 'gid-1', taskId: null, external: agreed })).toBeNull();
			expect(baselines.findOne).not.toHaveBeenCalled();
			expect(conflicts.manager.findOne).not.toHaveBeenCalled();
		});

		it('keeps a field changed only on the platform and finds one changed on both sides', async () => {
			const { service, baselines, conflicts } = harness();
			baselines.findOne.mockResolvedValue({ taskId: 'task-1', syncedFields: JSON.stringify(agreed) });
			conflicts.manager.findOne.mockResolvedValue(taskOf({ title: 'Platform title', status: 'In Review', taskStatusId: 's-review' }));
			const merge = await service.prepare({ ...scope, integrationId: 'int-1', sourceId: 'gid-1', taskId: 'task-1', external: { ...agreed, title: 'Asana title' } });
			expect(merge?.keepPlatform).toEqual(['status']);
			expect(merge?.conflicts).toEqual([{ field: 'title', synced: 'Agreed', platform: 'Platform title', external: 'Asana title' }]);
			expect(merge?.task).toMatchObject({ id: 'task-1', status: 'In Review', taskStatusId: 's-review' });
			// Scoped reads: the Asana task's baseline in the tenant, the task in its tenant and organization.
			expect(baselines.findOne).toHaveBeenCalledWith({ where: { integrationId: 'int-1', sourceId: 'gid-1', tenantId: 'tenant-1' } });
			expect(conflicts.manager.findOne.mock.calls[0][1].where).toEqual({ id: 'task-1', ...scope });
		});

		it('applies everything when the baseline was written for another task (the mapped task was re-created)', async () => {
			const { service, baselines, conflicts } = harness();
			baselines.findOne.mockResolvedValue({ taskId: 'task-old', syncedFields: JSON.stringify(agreed) });
			conflicts.manager.findOne.mockResolvedValue(taskOf({ title: 'Platform title' }));
			const merge = await service.prepare({ ...scope, integrationId: 'int-1', sourceId: 'gid-1', taskId: 'task-1', external: { ...agreed, title: 'Asana title' } });
			expect(merge).toMatchObject({ keepPlatform: [], conflicts: [] });
		});
	});

	describe('record (before the task is written), discard and settle (after)', () => {
		it('records each conflict with the task\'s value and columns as read before the write', async () => {
			const { service, conflicts } = harness();
			const task = taskOf({ status: 'In Review', taskStatusId: 's-review' });
			const recorded = await service.record({
				...scope,
				integrationId: 'int-1',
				mappingId: 'map-1',
				runId: 'run-1',
				sourceId: 'gid-1',
				merge: { keepPlatform: [], conflicts: [{ field: 'status', synced: 'Todo', platform: 'In Review', external: 'Done' }], task }
			});
			expect(recorded).toEqual([{ id: 'c-new-1', field: 'status' }]);
			expect(conflicts.save.mock.calls[0][0]).toEqual([
				expect.objectContaining({
					...scope,
					integrationId: 'int-1',
					mappingId: 'map-1',
					runId: 'run-1',
					taskId: 'task-1',
					sourceId: 'gid-1',
					field: 'status',
					syncedValue: 'Todo',
					platformValue: 'In Review',
					externalValue: 'Done',
					platformPatch: JSON.stringify({ status: 'In Review', taskStatusId: 's-review' }),
					status: AsanaSyncConflictStatus.OPEN
				})
			]);
			// Nothing superseded yet: the task is not written.
			expect(conflicts.update).not.toHaveBeenCalled();
		});

		it('records nothing for a merge without conflicts, or without a task', async () => {
			const { service, conflicts } = harness();
			const base = { ...scope, integrationId: 'int-1', mappingId: 'map-1', runId: 'run-1', sourceId: 'gid-1' };
			expect(await service.record({ ...base, merge: null })).toEqual([]);
			expect(await service.record({ ...base, merge: { keepPlatform: ['title'], conflicts: [], task: taskOf() } })).toEqual([]);
			expect(conflicts.save).not.toHaveBeenCalled();
		});

		it('takes the recorded conflicts back when the task could not be written', async () => {
			const { service, conflicts } = harness();
			await service.discard([]);
			expect(conflicts.delete).not.toHaveBeenCalled();
			await service.discard([{ id: 'c-new-1', field: 'status' }]);
			expect(conflicts.delete).toHaveBeenCalledTimes(1);
		});

		it('makes the Asana task\'s values the baseline: written once, updated after', async () => {
			const { service, baselines, conflicts } = harness();
			const input = { ...scope, integrationId: 'int-1', sourceId: 'gid-1', taskId: 'task-1', external: agreed, recorded: [] };
			await service.settle(input);
			expect(baselines.save).toHaveBeenCalledWith(expect.objectContaining({ ...scope, integrationId: 'int-1', sourceId: 'gid-1', taskId: 'task-1', syncedFields: JSON.stringify(agreed) }));
			baselines.findOne.mockResolvedValue({ id: 'base-1' });
			await service.settle({ ...input, external: { ...agreed, title: 'Next' } });
			expect(baselines.update).toHaveBeenCalledWith({ id: 'base-1' }, expect.objectContaining({ taskId: 'task-1', syncedFields: JSON.stringify({ ...agreed, title: 'Next' }) }));
			expect(conflicts.update).not.toHaveBeenCalled();
		});

		it('supersedes an older open conflict on a field just recorded, never the new one', async () => {
			const { service, conflicts } = harness();
			await service.settle({ ...scope, integrationId: 'int-1', sourceId: 'gid-1', taskId: 'task-1', external: agreed, recorded: [{ id: 'c-new-1', field: 'status' }] });
			const [criteria, change] = conflicts.update.mock.calls[0];
			expect(criteria).toMatchObject({ integrationId: 'int-1', taskId: 'task-1', status: AsanaSyncConflictStatus.OPEN, tenantId: 'tenant-1' });
			expect(criteria.id).toEqual(Not(In(['c-new-1'])));
			expect(criteria.field).toEqual(In(['status']));
			expect(change).toMatchObject({ status: AsanaSyncConflictStatus.RESOLVED, resolution: AsanaSyncConflictResolution.SUPERSEDED });
		});
	});

	describe('resolve', () => {
		const open = { id: 'c-1', ...scope, integrationId: 'int-1', taskId: 'task-1', field: 'status', externalValue: 'Done', platformValue: 'In Review', platformPatch: JSON.stringify({ status: 'In Review', taskStatusId: 's-review' }), status: AsanaSyncConflictStatus.OPEN };

		it('keeps Asana\'s value, already the task\'s, without writing the task', async () => {
			const { service, conflicts, commandBus } = harness();
			conflicts.findOne.mockResolvedValue({ ...open });
			const resolved = await service.resolve(tenant, 'c-1', 'external', 'user-9');
			expect(resolved).toMatchObject({ status: AsanaSyncConflictStatus.RESOLVED, resolution: AsanaSyncConflictResolution.KEPT_EXTERNAL, resolvedByUserId: 'user-9' });
			expect(conflicts.update).toHaveBeenCalledWith({ id: 'c-1', status: AsanaSyncConflictStatus.OPEN }, expect.objectContaining({ status: AsanaSyncConflictStatus.RESOLVED }));
			expect(commandBus.execute).not.toHaveBeenCalled();
		});

		it('writes the task\'s value back through the platform\'s task update, with its event (sent out by an outbound mapping)', async () => {
			const { service, conflicts, commandBus } = harness();
			conflicts.findOne.mockResolvedValue({ ...open });
			conflicts.manager.findOne.mockResolvedValue(taskOf({ status: 'done', taskStatusId: 's-done' }));
			const resolved = await service.resolve(tenant, 'c-1', 'platform', 'user-9');
			expect(resolved.resolution).toBe(AsanaSyncConflictResolution.KEPT_PLATFORM);
			const command = commandBus.execute.mock.calls[0][0] as TaskUpdateCommand;
			expect(command).toBeInstanceOf(TaskUpdateCommand);
			expect(command.id).toBe('task-1');
			expect(command.input).toEqual({ status: 'In Review', taskStatusId: 's-review', ...scope });
			expect(command.triggeredEvent).toBe(true);
		});

		it('refuses to overwrite a task whose field changed since the conflict was found', async () => {
			const { service, conflicts, commandBus } = harness();
			conflicts.findOne.mockResolvedValue({ ...open });
			conflicts.manager.findOne.mockResolvedValue(taskOf({ status: 'Blocked' }));
			await expect(service.resolve(tenant, 'c-1', 'platform', 'user-9')).rejects.toMatchObject({ response: { code: ASANA_CONFLICT_STALE } });
			await expect(service.resolve(tenant, 'c-1', 'platform', 'user-9')).rejects.toBeInstanceOf(ConflictException);
			expect(conflicts.update).not.toHaveBeenCalled();
			expect(commandBus.execute).not.toHaveBeenCalled();
		});

		it('answers 404 for a conflict of another connection, a resolved one, or one another manager claimed first', async () => {
			const { service, conflicts, commandBus } = harness();
			conflicts.findOne.mockResolvedValueOnce(null);
			await expect(service.resolve(tenant, 'c-1', 'external', null)).rejects.toBeInstanceOf(NotFoundException);
			expect(conflicts.findOne).toHaveBeenCalledWith({ where: { id: 'c-1', integrationId: 'int-1', tenantId: 'tenant-1' } });
			conflicts.findOne.mockResolvedValueOnce({ ...open, status: AsanaSyncConflictStatus.RESOLVED });
			await expect(service.resolve(tenant, 'c-1', 'external', null)).rejects.toMatchObject({ response: { code: ASANA_CONFLICT_NOT_FOUND } });
			conflicts.findOne.mockResolvedValueOnce({ ...open });
			conflicts.manager.findOne.mockResolvedValue(taskOf({ status: 'Done' }));
			conflicts.update.mockResolvedValueOnce({ affected: 0 });
			await expect(service.resolve(tenant, 'c-1', 'platform', null)).rejects.toBeInstanceOf(NotFoundException);
			expect(commandBus.execute).not.toHaveBeenCalled();
		});

		it('opens the conflict again when the task could not be written', async () => {
			const { service, conflicts, commandBus } = harness();
			conflicts.findOne.mockResolvedValue({ ...open });
			conflicts.manager.findOne.mockResolvedValue(taskOf({ status: 'Done' }));
			commandBus.execute.mockRejectedValue(new Error('store down'));
			await expect(service.resolve(tenant, 'c-1', 'platform', 'user-9')).rejects.toThrow('store down');
			expect(conflicts.update).toHaveBeenLastCalledWith({ id: 'c-1' }, expect.objectContaining({ status: AsanaSyncConflictStatus.OPEN, resolution: null, resolvedByUserId: null }));
		});
	});

	describe('restorePatchOf', () => {
		it('restores the recorded columns, a due date as a date', () => {
			expect(restorePatchOf(JSON.stringify({ priority: 'High', taskPriorityId: 'p-high' }), 'priority', 'High')).toEqual({ priority: 'High', taskPriorityId: 'p-high' });
			expect(restorePatchOf(JSON.stringify({ dueDate: '2026-11-10T00:00:00.000Z' }), 'dueDate', null)).toEqual({ dueDate: new Date('2026-11-10T00:00:00.000Z') });
			expect(restorePatchOf(JSON.stringify({ dueDate: null }), 'dueDate', null)).toEqual({ dueDate: null });
		});

		it('falls back to the shown value when the record cannot be read', () => {
			expect(restorePatchOf('{', 'title', 'Platform title')).toEqual({ title: 'Platform title' });
			expect(restorePatchOf(JSON.stringify({ other: 1 }), 'description', null)).toEqual({ description: null });
		});
	});
});
