import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
	ID,
	IRequestTimesheetProjectChange,
	ITimesheetProjectChangeRequest,
	IUpdateTimesheetProjectChangeStatus,
	PermissionsEnum,
	TimesheetProjectChangeStatus
} from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TenantAwareCrudService } from './../../core/crud';
import { Task } from './../../core/entities/internal';
import { TypeOrmOrganizationProjectRepository } from './../../organization-project/repository/type-orm-organization-project.repository';
import { TimeLog } from './../time-log/time-log.entity';
import { TypeOrmTimeLogRepository } from './../time-log/repository/type-orm-time-log.repository';
import { Timesheet } from './timesheet.entity';
import { TimesheetProjectChangeRequest } from './timesheet-project-change-request.entity';
import { MikroOrmTimesheetProjectChangeRequestRepository } from './repository/mikro-orm-timesheet-project-change-request.repository';
import { TypeOrmTimesheetProjectChangeRequestRepository } from './repository/type-orm-timesheet-project-change-request.repository';
import { TypeOrmTimesheetRepository } from './repository/type-orm-timesheet.repository';

/**
 * Handles the "switch a timesheet's project after creation" workflow from issue #9516.
 *
 * An employee raises a request against one of their own timesheets naming the project the
 * time is currently booked to, the project it should move to, and a reason. Somebody holding
 * `CAN_APPROVE_TIMESHEET` then approves or rejects it. Only an approval moves data, and it
 * only ever moves logs that sit on `previousProjectId` — the project lives on `TimeLog`, not
 * on `Timesheet`, and one timesheet routinely holds logs for several projects, so a blanket
 * reassignment would destroy correctly-booked time.
 */
@Injectable()
export class TimesheetProjectChangeRequestService extends TenantAwareCrudService<TimesheetProjectChangeRequest> {
	constructor(
		readonly typeOrmTimesheetProjectChangeRequestRepository: TypeOrmTimesheetProjectChangeRequestRepository,
		readonly mikroOrmTimesheetProjectChangeRequestRepository: MikroOrmTimesheetProjectChangeRequestRepository,
		private readonly typeOrmTimesheetRepository: TypeOrmTimesheetRepository,
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository
	) {
		super(typeOrmTimesheetProjectChangeRequestRepository, mikroOrmTimesheetProjectChangeRequestRepository);
	}

	/**
	 * Raise a project change request against one of the current employee's own timesheets.
	 *
	 * @param input timesheet, source project, target project and the mandatory reason
	 * @returns the created request, in `PENDING` state
	 */
	async requestProjectChange(input: IRequestTimesheetProjectChange): Promise<ITimesheetProjectChangeRequest> {
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
		const employeeId = RequestContext.currentEmployeeId();
		const { timesheetId, requestedProjectId, previousProjectId, organizationId, reason } = input;

		if (!employeeId) {
			throw new ForbiddenException('Only an employee can request a timesheet project change');
		}

		if (requestedProjectId === previousProjectId) {
			throw new BadRequestException('The requested project must differ from the current project');
		}

		// The timesheet has to exist inside the caller's tenant/organization AND belong to the caller.
		const timesheet = await this.typeOrmTimesheetRepository.findOne({
			where: { id: timesheetId, tenantId, organizationId, employeeId }
		});

		if (!timesheet) {
			throw new NotFoundException(`Timesheet with id '${timesheetId}' was not found`);
		}

		// A billed timesheet has already been invoiced and a locked one has been closed for edits.
		// Moving that time to another project would silently contradict what a client was charged.
		if (timesheet.isBilled) {
			throw new BadRequestException('This timesheet has already been billed and can no longer be changed');
		}

		if (timesheet.lockedAt) {
			throw new BadRequestException('This timesheet is locked and can no longer be changed');
		}

		// Both projects must be real projects of the same tenant/organization; without this check a
		// caller could book their time onto a project that belongs to somebody else.
		const projects = await this.typeOrmOrganizationProjectRepository.find({
			select: { id: true },
			where: { id: In([requestedProjectId, previousProjectId]), tenantId, organizationId }
		});

		if (projects.length !== 2) {
			throw new NotFoundException('One or both of the given projects were not found in this organization');
		}

		// Refuse a no-op: there has to be time on the source project for the request to mean anything.
		const affected = await this.typeOrmTimeLogRepository.count({
			where: { timesheetId, projectId: previousProjectId, tenantId, organizationId }
		});

		if (affected === 0) {
			throw new BadRequestException('This timesheet has no time logged against the given current project');
		}

		// Issue #9516: at most one open request per timesheet, so two approvals cannot race.
		const pending = await this.typeOrmTimesheetProjectChangeRequestRepository.count({
			where: { timesheetId, tenantId, organizationId, status: TimesheetProjectChangeStatus.PENDING }
		});

		if (pending > 0) {
			throw new BadRequestException('A pending project change request already exists for this timesheet');
		}

		return super.create({
			timesheetId,
			requestedProjectId,
			previousProjectId,
			reason,
			organizationId,
			tenantId,
			status: TimesheetProjectChangeStatus.PENDING
		});
	}

	/**
	 * Approve or reject a pending request. Approving moves every live time log of the timesheet
	 * that currently sits on `previousProjectId` over to `requestedProjectId`, atomically.
	 *
	 * @param id the request to review
	 * @param input the new status and an optional review note
	 * @returns the reviewed request
	 */
	async review(id: ID, input: IUpdateTimesheetProjectChangeStatus): Promise<ITimesheetProjectChangeRequest> {
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
		const { organizationId, status, reviewNote } = input;

		const request = await this.typeOrmTimesheetProjectChangeRequestRepository.findOne({
			where: { id, tenantId, organizationId }
		});

		if (!request) {
			throw new NotFoundException(`Project change request with id '${id}' was not found`);
		}

		if (request.status !== TimesheetProjectChangeStatus.PENDING) {
			throw new BadRequestException(`This request has already been ${request.status.toLowerCase()}`);
		}

		const reviewedAt = new Date();
		const reviewedById = RequestContext.currentUserId();

		await this.typeOrmTimesheetProjectChangeRequestRepository.manager.transaction(
			async (manager: EntityManager) => {
				// Claim the request by flipping it out of PENDING in one statement. Two approvers
				// clicking at the same moment would otherwise both pass the check above and both
				// run the reassignment; here the second one changes no rows and is told so.
				const claimed = await manager.update(
					TimesheetProjectChangeRequest,
					{ id, tenantId, organizationId, status: TimesheetProjectChangeStatus.PENDING },
					{ status, reviewNote: reviewNote ?? null, reviewedAt, reviewedById }
				);

				if (!claimed.affected) {
					throw new BadRequestException('This request has already been reviewed');
				}

				if (status === TimesheetProjectChangeStatus.APPROVED) {
					await this.reassignTimeLogs(manager, request);
				}
			}
		);

		request.status = status;
		request.reviewNote = reviewNote;
		request.reviewedAt = reviewedAt;
		request.reviewedById = reviewedById;

		return request;
	}

	/**
	 * List the requests raised against a timesheet, newest first.
	 *
	 * Employees only ever see requests on their own timesheets; holders of
	 * `CAN_APPROVE_TIMESHEET` see every request in the organization.
	 *
	 * @param timesheetId the timesheet to list requests for
	 * @param organizationId the organization the timesheet belongs to
	 * @returns the matching requests
	 */
	async findAllByTimesheet(timesheetId: ID, organizationId: ID): Promise<ITimesheetProjectChangeRequest[]> {
		const tenantId = RequestContext.currentTenantId();

		if (!RequestContext.hasPermission(PermissionsEnum.CAN_APPROVE_TIMESHEET, false)) {
			const employeeId = RequestContext.currentEmployeeId();
			const owned = employeeId
				? await this.typeOrmTimesheetRepository.count({
						where: { id: timesheetId, tenantId, organizationId, employeeId }
					})
				: 0;

			if (owned === 0) {
				throw new ForbiddenException('You are not allowed to view requests for this timesheet');
			}
		}

		return this.typeOrmTimesheetProjectChangeRequestRepository.find({
			where: { timesheetId, tenantId, organizationId },
			order: { createdAt: 'DESC' }
		});
	}

	/**
	 * Move the affected time logs onto the requested project.
	 *
	 * Only logs of THIS timesheet that are still booked to `previousProjectId` are touched, so
	 * time logged against other projects in the same timesheet is never disturbed. A moved log
	 * whose task does not belong to the target project is detached from that task, because a
	 * task cannot be carried across a project boundary.
	 *
	 * @param manager the transactional entity manager
	 * @param request the approved request
	 */
	private async reassignTimeLogs(manager: EntityManager, request: TimesheetProjectChangeRequest): Promise<void> {
		const { timesheetId, previousProjectId, requestedProjectId, tenantId, organizationId } = request;

		// Soft-deleted logs are excluded automatically — `deletedAt` is a TypeORM delete date column.
		const logs = await manager.find(TimeLog, {
			select: { id: true, taskId: true },
			where: { timesheetId, projectId: previousProjectId, tenantId, organizationId }
		});

		if (logs.length === 0) {
			return;
		}

		await manager.update(
			TimeLog,
			{ id: In(logs.map((log) => log.id)) },
			{ projectId: requestedProjectId, editedAt: new Date() }
		);

		// Tasks that legitimately belong to the target project may stay attached; any other task
		// reference has to be cleared, or the log would point at a task of a different project.
		const referencedTaskIds = [...new Set(logs.map((log) => log.taskId).filter(Boolean))];

		if (referencedTaskIds.length > 0) {
			const keptTasks = await manager.find(Task, {
				select: { id: true },
				where: { id: In(referencedTaskIds), projectId: requestedProjectId, tenantId, organizationId }
			});
			const keptTaskIds = new Set(keptTasks.map((task) => task.id));
			const detachIds = logs.filter((log) => log.taskId && !keptTaskIds.has(log.taskId)).map((log) => log.id);

			if (detachIds.length > 0) {
				await manager.update(TimeLog, { id: In(detachIds) }, { taskId: null });
			}
		}

		// Flag the timesheet as edited so reports and approvals can tell that it changed.
		await manager.update(Timesheet, { id: timesheetId, tenantId, organizationId }, { editedAt: new Date() });
	}
}
