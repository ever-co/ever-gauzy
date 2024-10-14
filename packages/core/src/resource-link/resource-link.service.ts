import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import {
	IResourceLink,
	IResourceLinkCreateInput,
	IResourceLinkUpdateInput,
	ID,
	ActionTypeEnum,
	BaseEntityEnum,
	ActorTypeEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { ActivityLogEvent } from '../activity-log/events';
import { activityLogUpdatedFieldsAndValues, generateActivityLogDescription } from '../activity-log/activity-log.helper';
import { UserService } from '../user/user.service';
import { ResourceLink } from './resource-link.entity';
import { TypeOrmResourceLinkRepository } from './repository/type-orm-resource-link.repository';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

@Injectable()
export class ResourceLinkService extends TenantAwareCrudService<ResourceLink> {
	constructor(
		readonly typeOrmResourceLinkRepository: TypeOrmResourceLinkRepository,
		readonly mikroOrmResourceLinkRepository: MikroOrmResourceLinkRepository,
		private readonly userService: UserService,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmResourceLinkRepository, mikroOrmResourceLinkRepository);
	}

	/**
	 * @description Create Resource Link
	 * @param {IResourceLinkCreateInput} input - Data to creating resource link
	 * @returns A promise that resolves to the created resource link
	 * @memberof ResourceLinkService
	 */
	async create(input: IResourceLinkCreateInput): Promise<IResourceLink> {
		try {
			const userId = RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId();
			const { ...entity } = input;

			// Employee existence validation
			const user = await this.userService.findOneByIdString(userId);
			if (!user) {
				throw new NotFoundException('User not found');
			}

			// return created resource link
			const resourceLink = await super.create({
				...entity,
				tenantId,
				creatorId: user.id
			});

			// Generate the activity log description.
			const description = generateActivityLogDescription(
				ActionTypeEnum.Created,
				BaseEntityEnum.ResourceLink,
				`${resourceLink.title} for ${resourceLink.entity}`
			);

			// Emit an event to log the activity
			this._eventBus.publish(
				new ActivityLogEvent({
					entity: BaseEntityEnum.ResourceLink,
					entityId: resourceLink.id,
					action: ActionTypeEnum.Created,
					actorType: ActorTypeEnum.User,
					description,
					data: resourceLink,
					organizationId: resourceLink.organizationId,
					tenantId
				})
			);

			return resourceLink;
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Resource Link creation failed', error);
		}
	}

	/**
	 * @description Update Resource Link
	 * @param {IResourceLinkUpdateInput} input - Data to update Resource Link
	 * @returns A promise that resolves to the updated resource link OR Update result
	 * @memberof ResourceLinkService
	 */
	async update(id: ID, input: IResourceLinkUpdateInput): Promise<IResourceLink | UpdateResult> {
		try {
			const resourceLink = await this.findOneByIdString(id);

			if (!resourceLink) {
				throw new BadRequestException('Resource Link not found');
			}

			const updatedResourceLink = await super.create({
				...input,
				id
			});

			// Generate the activity log description.
			const description = generateActivityLogDescription(
				ActionTypeEnum.Updated,
				BaseEntityEnum.ResourceLink,
				`${resourceLink.title} for ${resourceLink.entity}`
			);

			// Compare values before and after update then add updates to fields
			const { updatedFields, previousValues, updatedValues } = activityLogUpdatedFieldsAndValues(
				updatedResourceLink,
				input
			);

			// Emit event to log activity
			this._eventBus.publish(
				new ActivityLogEvent({
					entity: BaseEntityEnum.ResourceLink,
					entityId: updatedResourceLink.id,
					action: ActionTypeEnum.Updated,
					actorType: ActorTypeEnum.User,
					description,
					updatedFields,
					updatedValues,
					previousValues,
					data: updatedResourceLink,
					organizationId: updatedResourceLink.organizationId,
					tenantId: updatedResourceLink.tenantId
				})
			);

			// return updated Resource Link
			return updatedResourceLink;
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Resource Link update failed', error);
		}
	}
}
