import { BadRequestException, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { DeleteResult, FindOptionsWhere, In, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	BaseEntityEnum,
	ID,
	IMention,
	IMentionCreateInput,
	NotificationActionTypeEnum,
	EntitySubscriptionTypeEnum,
	EmployeeNotificationTypeEnum,
	ActorTypeEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions } from '../core/crud/icrud.service';
import { LegacyFindOneOptions } from '../core/utils';
import { RequestContext } from '../core/context';
import { assertCallerIsAuthorOrTenantAdmin, isCallerTenantAdmin, withoutAuthorChange } from '../shared/ownership';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { Mention } from './mention.entity';
import { TypeOrmMentionRepository } from './repository/type-orm-mention.repository';
import { MikroOrmMentionRepository } from './repository/mikro-orm-mention.repository';
import { CreateMentionEvent } from './events';
import { EmployeeNotificationService } from '../employee-notification/employee-notification.service';

@Injectable()
export class MentionService extends TenantAwareCrudService<Mention> {
	constructor(
		readonly typeOrmMentionRepository: TypeOrmMentionRepository,
		readonly mikroOrmMentionRepository: MikroOrmMentionRepository,
		private readonly _eventBus: EventBus,
		private readonly _employeeNotificationService: EmployeeNotificationService
	) {
		super(typeOrmMentionRepository, mikroOrmMentionRepository);
	}

	/**
	 * Creates a new mention entity in the database.
	 *
	 * @param {IMentionCreateInput} input - The data required to create a new mention entity.
	 * @returns {Promise<IMention>} A promise that resolves to the newly created mention entity.
	 * @throws {BadRequestException} If an error occurs during the creation process,
	 *   a `BadRequestException` is thrown with a descriptive message and the original error.
	 */
	async create(input: IMentionCreateInput): Promise<IMention> {
		try {
			// Retrieve currently logged-in user
			const user = RequestContext.currentUser();

			// Get the tenant ID from the current request context or use the one from the entity
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

			const {
				entity,
				entityId,
				parentEntityId,
				parentEntityType,
				mentionedEmployeeId,
				organizationId,
				entityName
			} = input;

			// Create the mention entry using the provided input along with the tenantId and mentionedEmployeeId.
			const mention = await super.create({
				...input,
				mentionedEmployeeId,
				organizationId,
				tenantId,
				employeeId: user.employeeId
			});

			// Subscribe the mentioned employee to the entity they were mentioned in
			this._eventBus.publish(
				new CreateEntitySubscriptionEvent({
					entity: parentEntityType ?? entity,
					entityId: parentEntityId ?? entityId,
					employeeId: mentionedEmployeeId,
					type: EntitySubscriptionTypeEnum.MENTION,
					organizationId,
					tenantId
				})
			);

			// Trigger internal system notification for mentioned user
			this._employeeNotificationService.publishNotificationEvent(
				{
					entity: parentEntityType ?? entity,
					entityId: parentEntityId ?? entityId,
					type: EmployeeNotificationTypeEnum.MENTION,
					organizationId,
					tenantId,
					// Without a receiver, the notification reached nobody
					receiverEmployeeId: mentionedEmployeeId,
					sentByEmployeeId: user.employeeId
				},
				NotificationActionTypeEnum.Mentioned,
				entityName,
				user.name
			);

			/**
			 * TODO
			 * 1. Send email notifications for both mention and optional subscription
			 */

			// Return the created mention.
			return mention;
		} catch (error) {
			console.log('Error while creating mention:', error);
			throw new BadRequestException('Error while creating mention', error);
		}
	}

	/**
	 * Publishes a `MentionEvent` to the event bus.
	 *
	 * @param {IMentionCreateInput} input - The input data required to create a new mention.
	 *
	 */
	publishMention(input: IMentionCreateInput) {
		this._eventBus.publish(new CreateMentionEvent(input));
	}

	/**
	 * Synchronize mentions for a given entity.
	 *
	 * This method handles adding new mentions and removing outdated mentions
	 * for an entity (e.g., comments, tasks, or projects). It ensures that only
	 * the specified user mentions (`newMentionEmployeeIds`) are associated with the entity.
	 *
	 * @param entity - The type of entity being updated (e.g., Comment, Task, etc.).
	 * @param entityId - The ID of the entity being updated.
	 * @param mentionEmployeeIds - Array of user IDs to be mentioned in this entity.
	 * @param parentEntityId - (Optional) The ID of the parent entity, if applicable.
	 * @param parentEntityType - (Optional) The type of the parent entity, if applicable.
	 * @param organizationId - The organization of the entity: the new mentions, their notification and
	 *   their subscription belong to it (they used to be created without one).
	 */
	async updateEntityMentions(
		entity: BaseEntityEnum,
		entityId: ID,
		mentionEmployeeIds: ID[],
		parentEntityId?: ID,
		parentEntityType?: BaseEntityEnum,
		organizationId?: ID
	): Promise<void> {
		try {
			const user = RequestContext.currentUser();

			// Retrieve existing mentions for the entity, whoever wrote them. Scoped to the caller's employee,
			// the mentions written by someone else were published again on each edit and never removed.
			// No `select`: on MikroORM `mentionedEmployeeId` is a `persist: false` relation mirror that a
			// partial load leaves unset, so every id read back as undefined. A full load fills it on both ORMs
			const existingMentions = await this.withoutEmployeeFilter(() =>
				super.find({ where: { entity, entityId } })
			);

			// Extract the IDs of currently mentioned users
			const existingMentionEmployeeIds = new Set(existingMentions.map((mention) => mention.mentionedEmployeeId));

			// Determine mentions to add (not present in existing mentions)
			const mentionsToAddEmployeeIds = mentionEmployeeIds.filter((id) => !existingMentionEmployeeIds.has(id));

			// Determine mentions to remove (present in existing mentions but not in mentionsIds)
			const mentionsToRemoveIds = [...existingMentionEmployeeIds].filter(
				(id) => !mentionEmployeeIds.includes(id)
			);

			// Remove outdated mentions, whoever wrote them. This runs before the new mentions are published, so
			// their handler, which creates the rows through this service in this same request, runs outside the bypass
			if (mentionsToRemoveIds.length > 0) {
				await this.withoutEmployeeFilter(() =>
					super.delete({ mentionedEmployeeId: In(mentionsToRemoveIds), entity, entityId })
				);
			}

			// Add new mentions
			if (mentionsToAddEmployeeIds.length > 0) {
				await Promise.all(
					mentionsToAddEmployeeIds.map((mentionedEmployeeId: ID) =>
						this.publishMention({
							entity: entity,
							entityId,
							parentEntityId,
							parentEntityType,
							mentionedEmployeeId,
							actorType: ActorTypeEnum.User,
							employeeId: user.employeeId,
							organizationId
						})
					)
				);
			}
		} catch (error) {
			console.log(`Error while updating mention: ${error.message}`, error);
			throw new BadRequestException('Error while updating mention', error);
		}
	}

	/**
	 * Changes a mention (`PUT /mentions/:id`, `updateMention`), if the caller wrote it or administers the tenant
	 * ({@link assertCallerMayChange}). The patch cannot say someone else wrote it ({@link withoutAuthorChange}).
	 *
	 * @param id - The mention's id, or criteria.
	 * @param input - The columns to write.
	 * @returns The update result, or the updated row, whichever the ORM answers.
	 */
	public async update(
		id: ID | FindOptionsWhere<Mention>,
		input: QueryDeepPartialEntity<Mention>
	): Promise<Mention | UpdateResult> {
		if (typeof id === 'string') {
			await this.assertCallerMayChange(id, false);
		}

		return super.update(id, withoutAuthorChange(input, ['employeeId', 'employee']));
	}

	/**
	 * Removes a mention (`DELETE /mentions/:id`, `deleteMention`), if the caller wrote it or administers the tenant.
	 * A call with object criteria is a service-level call — `updateEntityMentions` removes the mentions an edit
	 * dropped, whoever wrote them — and keeps the base behaviour.
	 *
	 * @param criteria - The mention's id, or criteria.
	 * @param options - Additional where conditions, passed to the base method unchanged.
	 * @returns The delete result.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<Mention>,
		options?: LegacyFindOneOptions<Mention>
	): Promise<DeleteResult> {
		if (typeof criteria === 'string') {
			await this.assertCallerMayChange(criteria, true);
		}

		return super.delete(criteria, options);
	}

	/**
	 * Withdraws a mention (`DELETE /mentions/:id/soft`, `softDeleteMention`), if the caller wrote it or administers
	 * the tenant.
	 *
	 * @param id - The mention to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn mention.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Mention>, saveOptions?: SaveOptions): Promise<Mention> {
		await this.assertCallerMayChange(id, false);

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn mention (`PUT /mentions/:id/recover`, `recoverMention`), if the caller wrote it or
	 * administers the tenant.
	 *
	 * @param id - The mention to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored mention.
	 */
	public async softRecover(id: ID, options?: IFindOneOptions<Mention>, saveOptions?: SaveOptions): Promise<Mention> {
		await this.assertCallerMayChange(id, true);

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * Who may change a mention: the one who wrote it — the user who created it, or the employee it names as its
	 * author (`employeeId`, stamped from the request by `create`) — or a tenant administrator (owner decision 2,
	 * 2026-10-22). The mention routes state no permission, so before this any member of the tenant could rewrite,
	 * withdraw or remove another member's mention; a caller without `CHANGE_SELECTED_EMPLOYEE` was held to their
	 * own employee's rows by the CRUD base, but a holder of it, or a caller with no employee record, was not.
	 *
	 * The read is the tenant-scoped one, so a mention of another tenant, or one that is not there, is still a 404.
	 *
	 * @param id - The mention's id.
	 * @param withDeleted - Whether a withdrawn mention counts (a recovery, and a removal, act on one).
	 * @throws ForbiddenException when the caller neither wrote it nor administers the tenant.
	 */
	private async assertCallerMayChange(id: ID, withDeleted: boolean): Promise<void> {
		if (isCallerTenantAdmin()) {
			return;
		}

		const mention = await this.findOneByIdString(id, withDeleted ? { withDeleted: true } : undefined);
		assertCallerIsAuthorOrTenantAdmin(
			{ userId: mention.createdByUserId, employeeId: mention.employeeId },
			'a mention'
		);
	}
}
