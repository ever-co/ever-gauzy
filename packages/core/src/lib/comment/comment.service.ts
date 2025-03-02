import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import {
	BaseEntityEnum,
	EntitySubscriptionTypeEnum,
	IComment,
	ICommentCreateInput,
	ICommentUpdateInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { EmployeeService } from '../employee/employee.service';
import { MentionService } from '../mention/mention.service';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm.comment.repository';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

@Injectable()
export class CommentService extends TenantAwareCrudService<Comment> {
	constructor(
		readonly typeOrmCommentRepository: TypeOrmCommentRepository,
		readonly mikroOrmCommentRepository: MikroOrmCommentRepository,
		private readonly _eventBus: EventBus,
		private readonly _employeeService: EmployeeService,
		private readonly _mentionService: MentionService
	) {
		super(typeOrmCommentRepository, mikroOrmCommentRepository);
	}

	/**
	 * Creates a new comment with the provided input, handling employee validation,
	 * publishing mention notifications, and subscribing the comment creator to the related entity.
	 *
	 * This function retrieves context-specific IDs from the RequestContext (tenant, employee)
	 * and falls back to the values in the input if necessary. It verifies that the employee exists,
	 * creates the comment, publishes mention notifications for each mentioned employee, and
	 * triggers a subscription event for the creator.
	 *
	 * @param {ICommentCreateInput} input - The input data required to create a comment, including text, mentions, and organization details.
	 * @returns {Promise<IComment>} A promise that resolves to the newly created comment.
	 * @throws {NotFoundException} If the employee associated with the comment is not found.
	 * @throws {BadRequestException} If any error occurs during the creation of the comment.
	 */
	async create(input: ICommentCreateInput): Promise<IComment> {
		try {
			// Retrieve context-specific IDs.
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const employeeId = RequestContext.currentEmployeeId() ?? input.employeeId;
			const { mentionEmployeeIds = [], organizationId, ...data } = input;

			// Validate that the employee exists.
			const employee = await this._employeeService.findOneByIdString(employeeId);
			if (!employee) {
				throw new NotFoundException(`Employee with id ${employeeId} not found`);
			}

			// Create the comment.
			const comment = await super.create({
				...data,
				employeeId,
				tenantId,
				organizationId
			});

			// Publish mentions for each mentioned employee, if any.
			await Promise.all(
				mentionEmployeeIds.map((mentionedEmployeeId: ID) =>
					this._mentionService.publishMention({
						entity: BaseEntityEnum.Comment,
						entityId: comment.id,
						entityName: input.entityName,
						parentEntityId: comment.entityId,
						parentEntityType: comment.entity,
						mentionedEmployeeId,
						organizationId: comment.organizationId,
						tenantId: comment.tenantId
					})
				)
			);

			// Subscribe the comment created by user to the entity.
			this._eventBus.publish(
				new CreateEntitySubscriptionEvent({
					entity: input.entity,
					entityId: input.entityId,
					employeeId,
					type: EntitySubscriptionTypeEnum.COMMENT,
					organizationId: comment.organizationId,
					tenantId: comment.tenantId
				})
			);

			// Return the newly created comment.
			return comment;
		} catch (error) {
			console.log(`Error while creating comment: ${error.message}`, error);
			throw new BadRequestException('Comment post failed', error);
		}
	}

	/**
	 * Updates an existing comment based on the provided id and update input.
	 *
	 * This function first retrieves the current employee's ID from the request context,
	 * then attempts to locate the comment matching the provided id and employeeId.
	 * If the comment is found, it creates an updated version of the comment using the input data.
	 * Additionally, it synchronizes any mention updates via the _mentionService.
	 *
	 * @param {ID} id - The unique identifier of the comment to update.
	 * @param {ICommentUpdateInput} input - The update data for the comment, including any mention updates.
	 * @returns {Promise<IComment | UpdateResult>} A promise that resolves to the updated comment or an update result.
	 * @throws {BadRequestException} If the comment is not found or if the update operation fails.
	 */
	async update(id: ID, input: ICommentUpdateInput): Promise<IComment | UpdateResult> {
		try {
			const employeeId = RequestContext.currentEmployeeId();
			const { mentionEmployeeIds = [] } = input;

			// Find the comment for the current employee with the given id.
			const comment = await this.findOneByWhereOptions({
				id,
				employeeId
			});

			if (!comment) {
				throw new BadRequestException(`Comment with id ${id} not found`);
			}

			// Update the comment with the new input data.
			const updatedComment = await super.create({
				...input,
				id
			});

			// Synchronize any mention updates for the comment.
			await this._mentionService.updateEntityMentions(
				BaseEntityEnum.Comment,
				id,
				mentionEmployeeIds,
				updatedComment.entityId,
				updatedComment.entity
			);

			return updatedComment;
		} catch (error) {
			console.log(`Error while updating comment: ${error.message}`, error);
			throw new BadRequestException('Comment update failed', error);
		}
	}
}
