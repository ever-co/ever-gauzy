import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, NotAcceptableException } from '@nestjs/common';
import { In } from 'typeorm';
import { ID, ITimesheet, PermissionsEnum, TimesheetStatus } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../../../core/context';
import { EmailService } from './../../../../email-send/email.service';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { TimeSheetService } from '../../timesheet.service';

/**
 * The statuses a team manager may give a member's timesheet: approved or denied.
 */
const TEAM_MANAGER_STATUSES: readonly TimesheetStatus[] = [TimesheetStatus.APPROVED, TimesheetStatus.DENIED];

/**
 * Refuses any other status to a caller who reaches the change as a team manager.
 *
 * @param status - The status the change asks for.
 * @throws ForbiddenException When the status is neither APPROVED nor DENIED.
 */
function assertTeamManagerStatus(status: TimesheetStatus): void {
	const approvesOrDenies = TEAM_MANAGER_STATUSES.includes(status);
	if (!approvesOrDenies) {
		throw new ForbiddenException('A team manager can only approve or deny a timesheet');
	}
}

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
	 * If the status is changed to `DENIED`, it records the given reason.
	 * After updating, it fetches the updated timesheets and sends email notifications to employees.
	 * A caller without `CAN_APPROVE_TIMESHEET` may only approve or deny the timesheets of the members of
	 * the teams they manage, never their own (see `TimeSheetService.forManagedEmployeeTimesheets`).
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
			// `undefined` is left out of the update, so the previous approver used to remain on a
			// timesheet that was denied or sent back after its approval
			approvedById: status === TimesheetStatus.APPROVED ? RequestContext.currentUserId() : null,
			approvedAt: status === TimesheetStatus.APPROVED ? new Date() : null,
			// A denial without a reason clears the one left by an earlier denial.
			...(status === TimesheetStatus.DENIED ? { reason: input.reason?.trim() || null } : {})
		};

		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		const applyChange = () => this.applyStatusChange(ids, organizationId, tenantId, updatePayload);

		if (this.needsTeamManagerCheck()) {
			assertTeamManagerStatus(status);
			return await this._timeSheetService.forManagedEmployeeTimesheets(ids, organizationId, applyChange);
		}

		return await applyChange();
	}

	/**
	 * Whether the change comes from a signed-in caller who may not approve every timesheet, so it has
	 * to go through the team manager check. A call with no user in context keeps the direct path.
	 */
	private needsTeamManagerCheck(): boolean {
		const hasCaller = RequestContext.currentUser() !== null;
		const canApproveAnyTimesheet = RequestContext.hasPermission(PermissionsEnum.CAN_APPROVE_TIMESHEET);

		return hasCaller && !canApproveAnyTimesheet;
	}

	/**
	 * Writes the new status, reads the timesheets back and e-mails their employees.
	 */
	private async applyStatusChange(
		ids: ID[],
		organizationId: ID,
		tenantId: ID,
		updatePayload: Partial<ITimesheet>
	): Promise<ITimesheet[]> {
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
