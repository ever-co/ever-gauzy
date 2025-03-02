import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { In, Not, IsNull } from 'typeorm';
import { ITimesheet } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { EmailService } from './../../../../email-send/email.service';
import { TimesheetSubmitCommand } from '../timesheet-submit.command';
import { TimeSheetService } from '../../timesheet.service';

@CommandHandler(TimesheetSubmitCommand)
export class TimesheetSubmitHandler implements ICommandHandler<TimesheetSubmitCommand> {
	constructor(readonly _timeSheetService: TimeSheetService, readonly _emailService: EmailService) {}

	/**
	 * Submits multiple timesheets by updating their status and sending notifications.
	 *
	 * @param {TimesheetSubmitCommand} command - The command containing timesheet IDs and submission status.
	 * @returns {Promise<ITimesheet[]>} - A promise resolving to the submitted timesheets.
	 *
	 * @throws {NotAcceptableException} - If no timesheet IDs are provided.
	 *
	 * @description
	 * This method updates the submission status of multiple timesheets. If the status is 'submit',
	 * it marks them as submitted by setting `submittedAt` to the current date. It then retrieves
	 * the updated timesheets and sends email notifications to employees.
	 */
	public async execute(command: TimesheetSubmitCommand): Promise<ITimesheet[]> {
		const { input } = command;
		let { ids, status, organizationId } = input;

		// Validate input
		if (isEmpty(ids)) {
			throw new NotAcceptableException('You cannot submit a timesheet without providing IDs');
		}

		// Normalize `ids` to always be an array
		ids = Array.isArray(ids) ? ids : [ids];

		// Define update payload
		const updatePayload = { submittedAt: status === 'submit' ? new Date() : null };

		// Update timesheets
		await this._timeSheetService.update({ id: In(ids), organizationId }, updatePayload);

		// Fetch updated timesheets with employee and user details
		const timesheets = await this._timeSheetService.find({
			relations: { employee: { user: true } },
			where: {
				id: In(ids),
				organizationId,
				submittedAt: Not(IsNull())
			},
			select: {
				employee: {
					id: true,
					organizationId: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						email: true
					}
				}
			}
		});

		// Send email notifications
		if (status === 'submit') {
			timesheets.forEach((timesheet: ITimesheet) => {
				// Retrieve employee and user details
				const employee = timesheet.employee;
				// Send email notification to employee
				if (employee?.user?.email) {
					this._emailService.timesheetSubmit(employee.user.email, timesheet);
				}
			});
		}

		return timesheets;
	}
}
