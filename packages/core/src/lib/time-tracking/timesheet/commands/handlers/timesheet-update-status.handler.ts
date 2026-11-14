import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, NotAcceptableException, Optional } from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere, In } from 'typeorm';
import { ID, ITimesheet, PermissionsEnum, TimesheetStatus } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../../../core/context';
import { EmailService } from './../../../../email-send/email.service';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { TimeSheetService } from '../../timesheet.service';
import { Timesheet } from '../../timesheet.entity';
import { TimeLog } from '../../../time-log/time-log.entity';
import { statusChange } from '../../../time-log/time-log-history';
import { historySubject, lockedForChange, recordTimeLogHistory } from '../../../time-log/time-log-history.writer';

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
	constructor(
		readonly _timeSheetService: TimeSheetService,
		readonly _emailService: EmailService,
		// Records the change in the history of each entry of the timesheets; a handler built without it records nothing.
		@Optional() private readonly dataSource?: DataSource
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
	 * Writes the new status. With a data source, the status and the history of the timesheets' entries are written in
	 * one transaction, or neither is, from the statuses read under lock in it: the history gives the status each change
	 * replaced, one saved meanwhile included. Without one, the status alone, through the CRUD service.
	 *
	 * @param where The timesheets of the change.
	 * @param updatePayload The status, and what goes with it.
	 */
	private async writeStatus(where: FindOptionsWhere<Timesheet>, updatePayload: Partial<ITimesheet>): Promise<void> {
		if (!this.dataSource) {
			await this._timeSheetService.update(where, updatePayload);
			return;
		}
		await this.dataSource.transaction(async (manager) => {
			const previousStatuses = await this.readStatuses(manager, where);
			await manager.update(Timesheet, where, updatePayload);
			await this.recordStatusHistory(manager, previousStatuses, updatePayload.status, updatePayload.reason);
		});
	}

	/** The status of each timesheet before the change, locked until the transaction of the change ends. */
	private async readStatuses(manager: EntityManager, where: FindOptionsWhere<Timesheet>): Promise<Map<ID, string>> {
		const statuses = new Map<ID, string>();
		const rows = await manager.find(Timesheet, { where, select: { id: true, status: true }, ...lockedForChange() });
		rows.forEach((row) => statuses.set(row.id, row.status));
		return statuses;
	}

	/**
	 * Records the status change in the history of every entry of the timesheets whose status changed, in the
	 * transaction of the change.
	 *
	 * @param manager The entity manager of that transaction.
	 * @param previousStatuses The status of each timesheet before the change.
	 * @param status The status after it.
	 * @param reason The reason of a denial, when one was given.
	 */
	private async recordStatusHistory(
		manager: EntityManager,
		previousStatuses: ReadonlyMap<ID, string>,
		status: string,
		reason: string | null | undefined
	): Promise<void> {
		const changedTimesheetIds = [...previousStatuses.keys()].filter((id) => previousStatuses.get(id) !== status);
		if (changedTimesheetIds.length === 0) {
			return;
		}
		const entries = await manager.find(TimeLog, {
			where: { timesheetId: In(changedTimesheetIds) },
			select: {
				id: true,
				employeeId: true,
				organizationId: true,
				tenantId: true,
				taskId: true,
				projectId: true,
				timesheetId: true
			}
		});
		const records = entries.map((entry) => ({
			subject: historySubject(entry),
			change: statusChange(previousStatuses.get(entry.timesheetId), status),
			reason
		}));
		await recordTimeLogHistory(manager, records);
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
		// Update timesheets, and the history of their entries with them
		await this.writeStatus({ id: In(ids), organizationId, tenantId }, updatePayload);

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
