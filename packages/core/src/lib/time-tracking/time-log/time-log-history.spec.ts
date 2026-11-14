import { ActionTypeEnum, TimeLogChangeKindEnum } from '@gauzy/contracts';
import {
	createdChange,
	deletedChange,
	historyValue,
	referencedEntities,
	referencedIds,
	statusChange,
	timeLogChangeKinds,
	updatedChange
} from './time-log-history';

const ENTRY = {
	startedAt: new Date('2026-11-10T09:00:00.000Z'),
	stoppedAt: new Date('2026-11-10T11:00:00.000Z'),
	employeeId: 'employee-paul',
	projectId: 'project-a',
	taskId: 'task-login',
	organizationContactId: 'client-a',
	organizationTeamId: null,
	description: null,
	isBillable: true
};

describe('time log history rules', () => {
	describe('historyValue', () => {
		it('stores the two time fields as ISO strings, from a Date or a string', () => {
			expect(historyValue('startedAt', new Date('2026-11-10T09:00:00Z'))).toBe('2026-11-10T09:00:00.000Z');
			expect(historyValue('stoppedAt', '2026-11-10T14:00:00+01:00')).toBe('2026-11-10T13:00:00.000Z');
		});

		it('reads a blank text and a missing value as null', () => {
			expect(historyValue('description', '   ')).toBeNull();
			expect(historyValue('taskId', undefined)).toBeNull();
			expect(historyValue('isBillable', false)).toBe(false);
		});
	});

	describe('updatedChange', () => {
		it('records the end before and after, with the duration, for 9-11 moved to 9-14', () => {
			const change = updatedChange(ENTRY, { ...ENTRY, stoppedAt: '2026-11-10T14:00:00.000Z' });

			expect(change).toEqual({
				action: ActionTypeEnum.Updated,
				updatedFields: ['stoppedAt', 'duration'],
				previousValues: [{ stoppedAt: '2026-11-10T11:00:00.000Z' }, { duration: 7200 }],
				updatedValues: [{ stoppedAt: '2026-11-10T14:00:00.000Z' }, { duration: 18000 }]
			});
		});

		it('records a task, a billable state and notes changed together', () => {
			const change = updatedChange(ENTRY, {
				...ENTRY,
				taskId: 'task-signup',
				isBillable: false,
				description: 'Pairing with Amina'
			});

			expect(change.updatedFields).toEqual(['taskId', 'description', 'isBillable']);
			expect(change.previousValues).toEqual([
				{ taskId: 'task-login' },
				{ description: null },
				{ isBillable: true }
			]);
			expect(change.updatedValues).toEqual([
				{ taskId: 'task-signup' },
				{ description: 'Pairing with Amina' },
				{ isBillable: false }
			]);
		});

		it('records nothing for a save that changes no tracked field', () => {
			expect(
				updatedChange(ENTRY, { ...ENTRY, startedAt: '2026-11-10T09:00:00.000Z', description: '' })
			).toBeNull();
		});

		it('leaves the duration out when both ends move by the same amount', () => {
			const change = updatedChange(ENTRY, {
				...ENTRY,
				startedAt: '2026-11-10T10:00:00.000Z',
				stoppedAt: '2026-11-10T12:00:00.000Z'
			});

			expect(change.updatedFields).toEqual(['startedAt', 'stoppedAt']);
		});
	});

	describe('createdChange and deletedChange', () => {
		it('records every field a new entry was written with, nothing before', () => {
			const change = createdChange(ENTRY);

			expect(change.action).toBe(ActionTypeEnum.Created);
			expect(change.previousValues).toEqual([]);
			expect(change.updatedFields).toEqual([
				'startedAt',
				'stoppedAt',
				'employeeId',
				'projectId',
				'taskId',
				'organizationContactId',
				'isBillable',
				'duration'
			]);
			expect(change.updatedValues).toContainEqual({ duration: 7200 });
		});

		it('records what a deleted entry held, nothing after', () => {
			const change = deletedChange(ENTRY);

			expect(change.action).toBe(ActionTypeEnum.Deleted);
			expect(change.updatedValues).toEqual([]);
			expect(change.previousValues).toContainEqual({ stoppedAt: '2026-11-10T11:00:00.000Z' });
			expect(change.previousValues).toContainEqual({ taskId: 'task-login' });
		});
	});

	describe('statusChange', () => {
		it('records the status before and after, and nothing when it stays', () => {
			expect(statusChange('PENDING', 'APPROVED')).toEqual({
				action: ActionTypeEnum.Updated,
				updatedFields: ['status'],
				previousValues: [{ status: 'PENDING' }],
				updatedValues: [{ status: 'APPROVED' }]
			});
			expect(statusChange('APPROVED', 'APPROVED')).toBeNull();
		});
	});

	describe('timeLogChangeKinds', () => {
		it('names the kinds of a change from its action and fields', () => {
			expect(timeLogChangeKinds(ActionTypeEnum.Created, ['startedAt'])).toEqual([TimeLogChangeKindEnum.CREATED]);
			expect(timeLogChangeKinds(ActionTypeEnum.Deleted, ['taskId'])).toEqual([TimeLogChangeKindEnum.DELETED]);
			expect(
				timeLogChangeKinds(ActionTypeEnum.Updated, ['stoppedAt', 'duration', 'organizationContactId'])
			).toEqual([TimeLogChangeKindEnum.TIME, TimeLogChangeKindEnum.PROJECT]);
			expect(timeLogChangeKinds(ActionTypeEnum.Updated, ['status'])).toEqual([TimeLogChangeKindEnum.STATUS]);
		});
	});

	describe('referenced records', () => {
		it('collects the ids of both sides and pairs each with its name', () => {
			const change = updatedChange(ENTRY, { ...ENTRY, taskId: 'task-signup' });
			const ids = referencedIds([change]);

			expect([...ids.get('taskId')]).toEqual(['task-login', 'task-signup']);
			expect(referencedEntities(change.previousValues, new Map([['task-login', 'Fix login']]))).toEqual([
				{ taskId: { id: 'task-login', name: 'Fix login' } }
			]);
			expect(referencedEntities(change.updatedValues, new Map())).toEqual([
				{ taskId: { id: 'task-signup', name: null } }
			]);
		});
	});
});
