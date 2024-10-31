import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	ITaskLinkedIssue,
	ITaskLinkedIssueCreateInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { MikroOrmTaskLinkedIssueRepository } from './repository/mikro-orm-linked-issue.repository';
import { TypeOrmTaskLinkedIssueRepository } from './repository/type-orm-linked-issue.repository';
import { taskRelatedIssueRelationMap } from './task-linked-issue.helper';

@Injectable()
export class TaskLinkedIssueService extends TenantAwareCrudService<TaskLinkedIssue> {
	constructor(
		@InjectRepository(TaskLinkedIssue)
		typeOrmTaskLinkedIssueRepository: TypeOrmTaskLinkedIssueRepository,

		mikroOrmTaskLinkedIssueRepository: MikroOrmTaskLinkedIssueRepository,

		private readonly activityLogService: ActivityLogService
	) {
		super(typeOrmTaskLinkedIssueRepository, mikroOrmTaskLinkedIssueRepository);
	}

	/**
	 * Creates a task linked to an issue.
	 *
	 * @param {ITaskLinkedIssueCreateInput} entity - The input data for creating a task linked issue.
	 * @returns {Promise<ITaskLinkedIssue>} The created task linked issue.
	 * @throws {HttpException} Throws a Bad Request exception if task creation fails.
	 *
	 */
	async create(entity: ITaskLinkedIssueCreateInput): Promise<ITaskLinkedIssue> {
		const tenantId = RequestContext.currentTenantId() || entity.tenantId;
		const { organizationId } = entity;

		try {
			const taskLinkedIssue = await super.create({ ...entity, tenantId });

			// Generate the activity log
			this.activityLogService.logActivity<TaskLinkedIssue>(
				BaseEntityEnum.TaskLinkedIssue,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				taskLinkedIssue.id,
				taskRelatedIssueRelationMap(taskLinkedIssue.action),
				taskLinkedIssue,
				organizationId,
				tenantId
			);

			// Return the created task linked issue
			return taskLinkedIssue;
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to create task linked issue : ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
