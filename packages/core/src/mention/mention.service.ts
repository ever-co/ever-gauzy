import { BadRequestException, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { IMention, IMentionCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Mention } from './mention.entity';
import { TypeOrmMentionRepository } from './repository/type-orm-mention.repository';
import { MikroOrmMentionRepository } from './repository/mikro-orm-mention.repository';
import { MentionEvent } from './events';

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
	 * @param {IMentionCreateInput} entity - The data required to create a new mention entity.
	 * @returns {Promise<IMention>} A promise that resolves to the newly created mention entity.
	 * @throws {BadRequestException} If an error occurs during the creation process,
	 *   a `BadRequestException` is thrown with a descriptive message and the original error.
	 */
	async create(entity: IMentionCreateInput): Promise<IMention> {
		try {
			// Retrieve the ID of the currently logged-in user
			const mentionById = RequestContext.currentUserId();

			// Get the tenant ID from the current request context or use the one from the entity
			const tenantId = RequestContext.currentTenantId() || entity.tenantId;

			// Create the mention entry using the provided input along with the tenantId and mentionById.
			const mention = await super.create({ ...entity, tenantId, mentionById });

			/**
			 * TODO
			 * 1. Optional create an user subscription for provided entity
			 * 2. Send email notifications and trigger internal system notifications for both mention and optional subscription
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
		this._eventBus.publish(new MentionEvent(input));
	}
}
