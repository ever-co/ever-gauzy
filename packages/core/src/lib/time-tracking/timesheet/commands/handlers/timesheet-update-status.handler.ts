import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { In } from 'typeorm';
import { ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../../../core/context';
import { EmailService } from './../../../../email-send/email.service';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { TimeSheetService } from '../../timesheet.service';

@CommandHandler(TimesheetUpdateStatusCommand)
export class TimesheetUpdateStatusHandler implements ICommandHandler<TimesheetUpdateStatusCommand> {
	constructor(readonly _timeSheetService: TimeSheetService, readonly _emailService: EmailService) {}

	/**
	 * Updates the status of one or multiple timesheets.
	 *
	 * @param {TimesheetUpdateStatusCommand} command - The command containing timesheet IDs and the new status.
	 * @returns {Promise<ITimesheet[]>} - The updated timesheets with employee and user details.
	 *
	 * @throws {NotAcceptableException} - If no timesheet IDs are provided.
	 *
	 * @description
	 * This method updates the status of multiple timesheets based on the provided `ids`.
	 * If the status is changed to `APPROVED`, it records the approver's ID and approval timestamp.
	 * After updating, it fetches the updated timesheets and sends email notifications to employees.
	 */
	public async execute(command: TimesheetUpdateStatusCommand): Promise<ITimesheet[]> {
		const { input } = command;
		let { ids, status, organizationId } = input;

		// Validate input
		if (isEmpty(ids)) {
			throw new NotAcceptableException('You cannot update timesheet status without providing IDs');
		}

		// Normalize ids to an array
		ids = Array.isArray(ids) ? ids : [ids];

		// Prepare update payload
		const updatePayload: Partial<ITimesheet> = {
			status,
			approvedById: status === TimesheetStatus.APPROVED ? RequestContext.currentUserId() : undefined,
			approvedAt: status === TimesheetStatus.APPROVED ? new Date() : null
		};

		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		// Update timesheets
		await this._timeSheetService.update({ id: In(ids), organizationId, tenantId }, updatePayload);

		// Fetch updated timesheets with employee and user details
		const timesheets = await this._timeSheetService.find({
			relations: { employee: { user: true } },
			where: { id: In(ids), organizationId },
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
		timesheets.forEach((timesheet: ITimesheet) => {
			// Retrieve employee and user details
			const employee = timesheet.employee;
			// Send email notification to employee
			if (employee?.user?.email) {
				this._emailService.setTimesheetAction(employee.user.email, timesheet);
			}
		});

		return timesheets;
	}
}
