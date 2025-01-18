import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../../../core/context';
import { EmailService } from './../../../../email-send/email.service';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { Timesheet } from './../../timesheet.entity';

@CommandHandler(TimesheetUpdateStatusCommand)
export class TimesheetUpdateStatusHandler implements ICommandHandler<TimesheetUpdateStatusCommand> {
	constructor(
		private readonly timeSheetRepository: Repository<Timesheet>,
		private readonly emailService: EmailService
	) {}

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
	 *
	 * @example
	 * ```ts
	 * const command = new TimesheetUpdateStatusCommand({ ids: ['123'], status: TimesheetStatus.APPROVED });
	 * const updatedTimesheets = await timesheetService.execute(command);
	 * console.log(updatedTimesheets);
	 * ```
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
		await this.timeSheetRepository.update({ id: In(ids), organizationId, tenantId }, updatePayload);

		// Fetch updated timesheets with employee and user details
		const timesheets = await this.timeSheetRepository.find({
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
			},
			where: { id: In(ids), organizationId, tenantId: RequestContext.currentTenantId() },
			relations: { employee: { user: true } }
		});

		// Send email notifications
		timesheets.forEach((timesheet: ITimesheet) => {
			const { employee } = timesheet;
			if (employee?.user?.email) {
				this.emailService.setTimesheetAction(employee.user.email, timesheet);
			}
		});

		return timesheets;
	}
}
