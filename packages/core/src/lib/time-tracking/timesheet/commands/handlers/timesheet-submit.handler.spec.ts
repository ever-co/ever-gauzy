// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { BadRequestException, NotAcceptableException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { TimesheetSubmitCommand } from '../timesheet-submit.command';
import { TimesheetSubmitHandler } from './timesheet-submit.handler';

/**
 * Submitting timesheets that are already submitted used to overwrite their `submittedAt` and email the
 * employee again. Only the timesheets this call moves from "not submitted" to "submitted" may be written
 * and announced; the response still lists every submitted timesheet named.
 */
const ORGANIZATION_ID = 'org-1';
const IDS = ['ts-1', 'ts-2'];

const timesheet = (id: string, email = `${id}@example.com`) => ({ id, employee: { user: { email } } });

describe('TimesheetSubmitHandler', () => {
	let timeSheetService: { find: jest.Mock; update: jest.Mock };
	let emailService: { timesheetSubmit: jest.Mock };
	let handler: TimesheetSubmitHandler;

	const run = (status: 'submit' | 'unsubmit', ids: string[] = IDS) =>
		handler.execute(new TimesheetSubmitCommand({ ids, status, organizationId: ORGANIZATION_ID } as any));

	beforeEach(() => {
		timeSheetService = { find: jest.fn(), update: jest.fn().mockResolvedValue({ affected: 1 }) };
		emailService = { timesheetSubmit: jest.fn() };
		handler = new TimesheetSubmitHandler(timeSheetService as any, emailService as any);
	});

	it('refuses an empty id list', async () => {
		await expect(run('submit', [])).rejects.toBeInstanceOf(NotAcceptableException);
		expect(timeSheetService.update).not.toHaveBeenCalled();
	});

	it('submits and emails every timesheet that was not submitted yet', async () => {
		timeSheetService.find
			.mockResolvedValueOnce([timesheet('ts-1'), timesheet('ts-2')]) // pending
			.mockResolvedValueOnce([timesheet('ts-1'), timesheet('ts-2')]); // submitted, after the update

		const result = await run('submit');

		// The pending lookup only reads timesheets that are not submitted yet, inside the organization
		const [{ where: pendingWhere }] = timeSheetService.find.mock.calls[0];
		expect(pendingWhere.organizationId).toBe(ORGANIZATION_ID);
		expect(pendingWhere.id.value).toEqual(IDS);
		expect(pendingWhere.submittedAt).toBeInstanceOf(FindOperator);
		expect(pendingWhere.submittedAt.type).toBe('isNull');

		// One guarded write per timesheet, all stamped with the same time
		expect(timeSheetService.update).toHaveBeenCalledTimes(2);
		for (const [criteria, payload] of timeSheetService.update.mock.calls) {
			expect(criteria.organizationId).toBe(ORGANIZATION_ID);
			// The write itself only matches a timesheet that is still not submitted
			expect(criteria.submittedAt).toBeInstanceOf(FindOperator);
			expect(criteria.submittedAt.type).toBe('isNull');
			expect(payload.submittedAt).toBeInstanceOf(Date);
		}
		const stamps = timeSheetService.update.mock.calls.map(([, payload]) => payload.submittedAt.getTime());
		expect(new Set(stamps).size).toBe(1);
		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(2);
		expect(result).toHaveLength(2);
	});

	it('leaves an already submitted timesheet untouched and does not email it again', async () => {
		timeSheetService.find
			.mockResolvedValueOnce([timesheet('ts-2')]) // only ts-2 is still pending
			.mockResolvedValueOnce([timesheet('ts-1'), timesheet('ts-2')]);

		const result = await run('submit');

		expect(timeSheetService.update).toHaveBeenCalledTimes(1);
		const [criteria] = timeSheetService.update.mock.calls[0];
		expect(criteria.id).toBe('ts-2');
		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(1);
		expect(emailService.timesheetSubmit).toHaveBeenCalledWith(
			'ts-2@example.com',
			expect.objectContaining({ id: 'ts-2' })
		);
		// The response still lists every submitted timesheet that was named
		expect(result.map((item) => item.id)).toEqual(['ts-1', 'ts-2']);
	});

	it('does not email or fail when an overlapping submit wins the write (criteria matches no row)', async () => {
		timeSheetService.find
			.mockResolvedValueOnce([timesheet('ts-1'), timesheet('ts-2')]) // both read as pending
			.mockResolvedValueOnce([timesheet('ts-1'), timesheet('ts-2')]);
		timeSheetService.update.mockImplementation(async (criteria: { id: string }) => {
			if (criteria.id === 'ts-1') throw new NotFoundException('The requested record was not found');
			return { affected: 1 };
		});

		const result = await run('submit');

		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(1);
		expect(emailService.timesheetSubmit).toHaveBeenCalledWith('ts-2@example.com', expect.anything());
		expect(result).toHaveLength(2);
	});

	it('does not email a timesheet whose guarded write affected no row', async () => {
		timeSheetService.find
			.mockResolvedValueOnce([timesheet('ts-1')])
			.mockResolvedValueOnce([timesheet('ts-1')]);
		timeSheetService.update.mockResolvedValue({ affected: 0 });

		await run('submit', ['ts-1']);

		expect(emailService.timesheetSubmit).not.toHaveBeenCalled();
	});

	it('does not email a timesheet when the write result reports no affected count', async () => {
		timeSheetService.find
			.mockResolvedValueOnce([timesheet('ts-1')])
			.mockResolvedValueOnce([timesheet('ts-1')]);
		timeSheetService.update.mockResolvedValue({});

		await run('submit', ['ts-1']);

		expect(emailService.timesheetSubmit).not.toHaveBeenCalled();
	});

	it('emails once and keeps the first timestamp when two submits overlap on the same timesheet', async () => {
		// A store that honours the `submittedAt IS NULL` condition of the write, as the database does
		const store = new Map<string, Date | null>([['ts-1', null]]);
		timeSheetService.find.mockImplementation(async (options: any) => {
			const { submittedAt } = options.where;
			const wantsPending = submittedAt.type === 'isNull';
			return [...store.entries()]
				.filter(([, value]) => (value === null) === wantsPending)
				.map(([id]) => timesheet(id));
		});
		timeSheetService.update.mockImplementation(async (criteria: any, payload: any) => {
			if (store.get(criteria.id) !== null) {
				return { affected: 0 };
			}
			store.set(criteria.id, payload.submittedAt);
			return { affected: 1 };
		});

		const [first, second] = await Promise.all([run('submit', ['ts-1']), run('submit', ['ts-1'])]);

		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(1);
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
		expect(store.get('ts-1')).toBeInstanceOf(Date);
	});

	it('still surfaces a write failure that is not a lost race', async () => {
		timeSheetService.find.mockResolvedValueOnce([timesheet('ts-1')]);
		timeSheetService.update.mockRejectedValue(new BadRequestException('boom'));

		await expect(run('submit', ['ts-1'])).rejects.toBeInstanceOf(BadRequestException);
		expect(emailService.timesheetSubmit).not.toHaveBeenCalled();
	});

	it('announces the timesheets it did submit before reporting a failed sibling, and a retry submits the rest', async () => {
		// A store that honours the `submittedAt IS NULL` condition of the write, as the database does
		const store = new Map<string, Date | null>([
			['ts-1', null],
			['ts-2', null]
		]);
		timeSheetService.find.mockImplementation(async (options: any) => {
			const wantsPending = options.where.submittedAt.type === 'isNull';
			return [...store.entries()]
				.filter(([, value]) => (value === null) === wantsPending)
				.map(([id]) => timesheet(id));
		});
		let failNext = true;
		timeSheetService.update.mockImplementation(async (criteria: any, payload: any) => {
			if (criteria.id === 'ts-2' && failNext) {
				failNext = false;
				throw new BadRequestException('connection lost');
			}
			if (store.get(criteria.id) !== null) {
				return { affected: 0 };
			}
			store.set(criteria.id, payload.submittedAt);
			return { affected: 1 };
		});

		// ts-1 commits, ts-2 fails: ts-1 is still announced, and the failure is reported
		await expect(run('submit')).rejects.toBeInstanceOf(BadRequestException);
		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(1);
		expect(emailService.timesheetSubmit).toHaveBeenCalledWith(
			'ts-1@example.com',
			expect.objectContaining({ id: 'ts-1' })
		);
		const firstStamp = store.get('ts-1');
		expect(firstStamp).toBeInstanceOf(Date);
		expect(store.get('ts-2')).toBeNull();

		// The retry submits and announces ts-2 only; ts-1 keeps its time and is not emailed again
		const result = await run('submit');
		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(2);
		expect(emailService.timesheetSubmit).toHaveBeenLastCalledWith(
			'ts-2@example.com',
			expect.objectContaining({ id: 'ts-2' })
		);
		expect(store.get('ts-1')).toBe(firstStamp);
		expect(result.map((item) => item.id)).toEqual(['ts-1', 'ts-2']);
	});

	it('writes and emails nothing when every timesheet is already submitted', async () => {
		timeSheetService.find
			.mockResolvedValueOnce([]) // nothing pending
			.mockResolvedValueOnce([timesheet('ts-1'), timesheet('ts-2')]);

		const result = await run('submit');

		expect(timeSheetService.update).not.toHaveBeenCalled();
		expect(emailService.timesheetSubmit).not.toHaveBeenCalled();
		expect(result).toHaveLength(2);
	});

	it('still clears submittedAt on unsubmit, without a pending lookup or emails', async () => {
		timeSheetService.find.mockResolvedValueOnce([]);

		await run('unsubmit');

		expect(timeSheetService.find).toHaveBeenCalledTimes(1);
		const [criteria, payload] = timeSheetService.update.mock.calls[0];
		expect(criteria.organizationId).toBe(ORGANIZATION_ID);
		expect(payload).toEqual({ submittedAt: null });
		expect(emailService.timesheetSubmit).not.toHaveBeenCalled();
	});
});
