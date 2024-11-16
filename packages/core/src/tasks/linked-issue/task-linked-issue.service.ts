import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	ID,
	ITaskLinkedIssue,
	ITaskLinkedIssueCreateInput,
	ITaskLinkedIssueUpdateInput
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

	/**
	 * Updates a task linked issue.
	 *
	 * @param {ID} id - The ID of the task linked issue to update.
	 * @param {ITaskLinkedIssueUpdateInput} input - The input data for updating the task linked issue.
	 * @returns {Promise<ITaskLinkedIssue>} The updated task linked issue.
	 * @throws {HttpException} Throws a Bad Request exception if the update fails.
	 * @throws {NotFoundException} Throws a Not Found exception if the task linked issue does not exist.
	 *
	 */
	async update(id: ID, input: ITaskLinkedIssueUpdateInput): Promise<ITaskLinkedIssue> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		try {
			// Retrieve existing task linked issue
			const existingTaskLinkedIssue = await this.findOneByIdString(id);

			if (!existingTaskLinkedIssue) {
				throw new NotFoundException('Task linked issue not found');
			}

			const updatedTaskLinkedIssue = await super.create({ ...input, tenantId, id });

			// Generate the activity log
			const { organizationId } = updatedTaskLinkedIssue;
			this.activityLogService.logActivity<TaskLinkedIssue>(
				BaseEntityEnum.TaskLinkedIssue,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				updatedTaskLinkedIssue.id,
				taskRelatedIssueRelationMap(updatedTaskLinkedIssue.action),
				updatedTaskLinkedIssue,
				organizationId,
				tenantId,
				existingTaskLinkedIssue,
				input
			);

			// return the updated task linked issue
			return updatedTaskLinkedIssue;
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to update task linked issue: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Deletes a task linked issue and logs the deletion activity.
	 *
	 * @param id - The ID of the task linked issue to delete.
	 * @param options - Optional find options for the task linked issue.
	 * @returns A promise that resolves to the result of the delete operation.
	 */
	async delete(id: ID, options?: FindOneOptions<TaskLinkedIssue>): Promise<DeleteResult> {
		try {
			await this.deleteActivityLog(id);
			return super.delete(id, options);
		} catch (error) {
			console.error(`Failed to delete task linked issue (ID: ${id}):`, error);
			throw new HttpException(`Failed to delete task linked issue: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Soft deletes a task linked issue and logs the deletion activity.
	 *
	 * @param id - The ID of the task linked issue to soft delete.
	 * @returns A promise that resolves to the result of the soft delete operation or the deleted entity.
	 */
	async softDelete(id: ID): Promise<TaskLinkedIssue | UpdateResult> {
		try {
			await this.deleteActivityLog(id);
			return super.softDelete(id);
		} catch (error) {
			console.error(`Failed to soft delete task linked issue (ID: ${id}):`, error);
			throw new HttpException(`Failed to soft delete task linked issue: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Deletes an activity log for a given task linked issue.
	 *
	 * @param id - The ID of the task linked issue to delete.
	 */
	private async deleteActivityLog(id: ID) {
		const tenantId = RequestContext.currentTenantId();

		try {
			  // Retrieve existing task linked issue
			  const existingTaskLinkedIssue = await this.findOneByIdString(id);
			  if (!existingTaskLinkedIssue) {
				  throw new NotFoundException('Task linked issue not found');
			  }

			// Generate deleted activity log
			const { organizationId } = existingTaskLinkedIssue;
			this.activityLogService.logActivity<TaskLinkedIssue>(
				BaseEntityEnum.TaskLinkedIssue,
				ActionTypeEnum.Deleted,
				ActorTypeEnum.User,
				id,
				taskRelatedIssueRelationMap(existingTaskLinkedIssue.action),
				existingTaskLinkedIssue,
				organizationId,
				tenantId
			);
		} catch (error) {
			console.error(`Failed to create activity log for deletion (ID: ${id}):`, error);
		}
	}
}
