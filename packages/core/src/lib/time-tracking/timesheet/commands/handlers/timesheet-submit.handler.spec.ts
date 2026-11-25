// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { NotAcceptableException } from '@nestjs/common';
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
		timeSheetService = { find: jest.fn(), update: jest.fn().mockResolvedValue({}) };
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

		expect(timeSheetService.update).toHaveBeenCalledTimes(1);
		const [criteria, payload] = timeSheetService.update.mock.calls[0];
		expect(criteria.organizationId).toBe(ORGANIZATION_ID);
		expect(payload.submittedAt).toBeInstanceOf(Date);
		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(2);
		expect(result).toHaveLength(2);
	});

	it('leaves an already submitted timesheet untouched and does not email it again', async () => {
		timeSheetService.find
			.mockResolvedValueOnce([timesheet('ts-2')]) // only ts-2 is still pending
			.mockResolvedValueOnce([timesheet('ts-1'), timesheet('ts-2')]);

		const result = await run('submit');

		const [criteria] = timeSheetService.update.mock.calls[0];
		expect(criteria.id.value).toEqual(['ts-2']);
		expect(emailService.timesheetSubmit).toHaveBeenCalledTimes(1);
		expect(emailService.timesheetSubmit).toHaveBeenCalledWith(
			'ts-2@example.com',
			expect.objectContaining({ id: 'ts-2' })
		);
		// The response still lists every submitted timesheet that was named
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
