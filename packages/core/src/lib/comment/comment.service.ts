import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SaveOptions, UpdateResult } from 'typeorm';
import {
	BaseEntityEnum,
	EntitySubscriptionTypeEnum,
	IComment,
	ICommentCreateInput,
	ICommentUpdateInput,
	ID,
	PermissionsEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions } from '../core/crud/icrud.service';
import { LegacyFindOneOptions } from '../core/utils';
import { RequestContext } from '../core/context';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { EmployeeService } from '../employee/employee.service';
import { MentionService } from '../mention/mention.service';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm-comment.repository';
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
			// The author is the caller's own employee. RequestContext.currentEmployeeId() is deliberately
			// null for CHANGE_SELECTED_EMPLOYEE holders, so fall back to the JWT user's employee before the
			// body value; a caller with no employee identity at all posts an author-less comment (as before).
			const employeeId =
				RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? input.employeeId;
			const { mentionEmployeeIds = [], organizationId, ...data } = input;

			// Validate that the employee exists (only a real id can be looked up — an empty one used to
			// match an arbitrary employee and pass vacuously).
			if (employeeId) {
				const employee = await this._employeeService.findOneByIdString(employeeId);
				if (!employee) {
					throw new NotFoundException(`Employee with id ${employeeId} not found`);
				}
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
	 * Additionally, it synchronizes any mention updates via the _mentionService: an omitted
	 * `mentionEmployeeIds` leaves the comment's mentions as they are, and an array, `[]` included,
	 * replaces them.
	 *
	 * @param {ID} id - The unique identifier of the comment to update.
	 * @param {ICommentUpdateInput} input - The update data for the comment, including any mention updates.
	 * @returns {Promise<IComment | UpdateResult>} A promise that resolves to the updated comment or an update result.
	 * @throws {BadRequestException} If the comment is not found or if the update operation fails.
	 */
	async update(id: ID, input: ICommentUpdateInput): Promise<IComment | UpdateResult> {
		try {
			const employeeId = RequestContext.currentEmployeeId();
			const canChangeSelectedEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
			const { mentionEmployeeIds } = input;

			// Find the comment for the current employee with the given id. Callers holding
			// CHANGE_SELECTED_EMPLOYEE may edit any comment of the tenant; everyone else must be the
			// author — and therefore must have an employee identity (a null key was previously just
			// dropped from the query, which let employee-less callers edit anything).
			if (!canChangeSelectedEmployee && !employeeId) {
				throw new ForbiddenException(`You don't have permission to update this comment`);
			}
			const comment = await this.findOneByWhereOptions({
				id,
				...(canChangeSelectedEmployee ? {} : { employeeId })
			});

			if (!comment) {
				throw new BadRequestException(`Comment with id ${id} not found`);
			}

			// Update the comment with the new input data.
			const updatedComment = await super.create({
				...input,
				id
			});

			// Synchronize mention updates only when the caller sent the list (a resolve or reopen does not).
			if (Array.isArray(mentionEmployeeIds)) {
				await this._mentionService.updateEntityMentions(
					BaseEntityEnum.Comment,
					id,
					mentionEmployeeIds,
					// The parent is read from the stored row: an update cannot move a comment, and the
					// TypeORM save result carries neither field
					comment.entityId,
					comment.entity,
					// The saved organization: the edit may have moved the comment to another one
					updatedComment.organizationId ?? comment.organizationId
				);
			}

			return updatedComment;
		} catch (error) {
			if (error instanceof ForbiddenException) {
				throw error;
			}
			console.log(`Error while updating comment: ${error.message}`, error);
			throw new BadRequestException('Comment update failed', error);
		}
	}

	/**
	 * Withdraws a comment (`DELETE /comment/:id/soft`, `softDeleteComment`) on the terms an edit is allowed on.
	 *
	 * See {@link assertMayManage}: the CRUD base's own scope let a caller with no employee identity who may not act
	 * for others withdraw any comment of the tenant, while `update` refuses that caller outright.
	 *
	 * @param id - The comment to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn comment.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Comment>, saveOptions?: SaveOptions): Promise<Comment> {
		await this.assertMayManage(id, false);

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn comment (`PUT /comment/:id/recover`, `recoverComment`) on the terms an edit is allowed on.
	 *
	 * @param id - The comment to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored comment.
	 */
	public async softRecover(id: ID, options?: IFindOneOptions<Comment>, saveOptions?: SaveOptions): Promise<Comment> {
		await this.assertMayManage(id, true);

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * Removes a comment (`DELETE /comment/:id`, `deleteComment`) on the terms an edit is allowed on, when it is
	 * addressed by its id — which is how both routes address it. A call with object criteria is a service-level
	 * call rather than a caller's request, and keeps the base behaviour.
	 *
	 * @param criteria - The comment's id, or criteria.
	 * @param options - Additional where conditions, passed to the base method unchanged.
	 * @returns The delete result.
	 */
	public async delete(criteria: string | FindOptionsWhere<Comment>, options?: LegacyFindOneOptions<Comment>): Promise<DeleteResult> {
		// The removal deletes the row whatever its `deletedAt`, so a withdrawn comment is still its author's to
		// remove: the ownership read includes withdrawn rows.
		if (typeof criteria === 'string') {
			await this.assertMayManage(criteria, true);
		}

		return super.delete(criteria, options);
	}

	/**
	 * Who may withdraw, restore or remove a comment: the rule `update` applies to whose comment a caller may change
	 * (owner decision 5, 2026-10-13: these routes stay equal to `update` — which states no permission, and enforces
	 * this instead), with one addition so that no author loses a removal they have today.
	 *
	 * - A CHANGE_SELECTED_EMPLOYEE holder may act on any comment of the tenant (the base scope keeps it to the tenant).
	 * - A caller with an employee identity may act on that employee's comments only — the read goes through the
	 *   tenant-scoped finder with the author stated, so another employee's comment answers 404.
	 * - A caller with no employee identity may act only on the comments they posted themselves (`createdByUserId`).
	 *   `create` lets such a caller post an author-less comment, and the documents UI removes a comment with
	 *   `DELETE /comment/:id`; `update` refuses them outright, but refusing the removal of their own comment
	 *   would take away a flow they have. What they lose is what the base scope wrongly gave them: every other
	 *   comment of the tenant.
	 *
	 * A restoration reads among withdrawn rows. The refusal is raised before the base method runs, because the base
	 * rethrows whatever fails inside it as a 404.
	 *
	 * @param id - The comment acted on.
	 * @param withDeleted - Whether the comment is read among withdrawn rows (a restoration, or a removal).
	 * @throws {ForbiddenException} When the caller has neither an employee identity nor a user identity.
	 * @throws {NotFoundException} When the comment is not one the caller may act on.
	 */
	private async assertMayManage(id: ID, withDeleted: boolean): Promise<void> {
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return;
		}

		const employeeId = RequestContext.currentEmployeeId();
		const userId = RequestContext.currentUserId();
		if (!employeeId && !userId) {
			throw new ForbiddenException(`You don't have permission to manage this comment`);
		}

		const own = (employeeId ? { employeeId } : { createdByUserId: userId }) as FindOptionsWhere<Comment>;
		await this.findOneByIdString(id, { where: own, ...(withDeleted ? { withDeleted: true } : {}) });
	}
}
