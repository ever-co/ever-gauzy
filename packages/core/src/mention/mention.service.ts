import { BadRequestException, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { BaseEntityEnum, ID, IMention, IMentionCreateInput, SubscriptionTypeEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Mention } from './mention.entity';
import { TypeOrmMentionRepository } from './repository/type-orm-mention.repository';
import { MikroOrmMentionRepository } from './repository/mikro-orm-mention.repository';
import { CreateMentionEvent } from './events';
import { CreateSubscriptionEvent } from '../subscription/events';

@Injectable()
export class MentionService extends TenantAwareCrudService<Mention> {
	constructor(
		readonly typeOrmMentionRepository: TypeOrmMentionRepository,
		readonly mikroOrmMentionRepository: MikroOrmMentionRepository,
		private readonly _eventBus: EventBus
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
			const { entity, entityId, parentEntityId, parentEntityType, mentionedUserId, organizationId } = input;

			// Retrieve the ID of the currently logged-in user
			const mentionById = RequestContext.currentUserId();

			// Get the tenant ID from the current request context or use the one from the entity
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Create the mention entry using the provided input along with the tenantId and mentionById.
			const mention = await super.create({ ...input, tenantId, mentionById });

			// Create an user subscription for provided entity
			this._eventBus.publish(
				new CreateSubscriptionEvent({
					entity: parentEntityType ?? entity,
					entityId: parentEntityId ?? entityId,
					userId: mentionedUserId,
					subscriptionType: SubscriptionTypeEnum.MENTION,
					organizationId,
					tenantId
				})
			);

			/**
			 * TODO
			 * 1. Send email notifications and trigger internal system notifications for both mention and optional subscription
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
	 * the specified user mentions (`newMentionIds`) are associated with the entity.
	 *
	 * @param entity - The type of entity being updated (e.g., Comment, Task, etc.).
	 * @param entityId - The ID of the entity being updated.
	 * @param mentionIds - Array of user IDs to be mentioned in this entity.
	 * @param parentEntityId - (Optional) The ID of the parent entity, if applicable.
	 * @param parentEntityType - (Optional) The type of the parent entity, if applicable.
	 */
	async updateEntityMentions(
		entity: BaseEntityEnum,
		entityId: ID,
		mentionsIds: ID[],
		parentEntityId?: ID,
		parentEntityType?: BaseEntityEnum
	): Promise<void> {
		try {
			const actorId = RequestContext.currentUserId();

			// Retrieve existing mentions for the entity
			const existingMentions = await this.find({
				where: { entity, entityId },
				select: ['mentionedUserId']
			});

			// Extract the IDs of currently mentioned users
			const existingMentionUserIds = new Set(existingMentions.map((mention) => mention.mentionedUserId));

			// Determine mentions to add (not present in existing mentions)
			const mentionsToAdd = mentionsIds.filter((id) => !existingMentionUserIds.has(id));

			// Determine mentions to remove (present in existing mentions but not in mentionsIds)
			const mentionsToRemove = [...existingMentionUserIds].filter((id) => !mentionsIds.includes(id));

			// Add new mentions
			if (mentionsToAdd.length > 0) {
				await Promise.all(
					mentionsToAdd.map((mentionedUserId) =>
						this.publishMention({
							entity: entity,
							entityId,
							mentionedUserId,
							mentionById: actorId,
							parentEntityId,
							parentEntityType
						})
					)
				);
			}

			// Remove outdated mentions
			if (mentionsToRemove.length > 0) {
				await this.delete({
					mentionedUserId: In(mentionsToRemove),
					entity,
					entityId
				});
			}
		} catch (error) {
			console.log(error);
		}
	}
}
