import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import {
	IResourceLink,
	IResourceLinkCreateInput,
	IResourceLinkUpdateInput,
	ID,
	BaseEntityEnum,
	ActorTypeEnum,
	ActionTypeEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { UserService } from '../user/user.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ResourceLink } from './resource-link.entity';
import { TypeOrmResourceLinkRepository } from './repository/type-orm-resource-link.repository';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

@Injectable()
export class ResourceLinkService extends TenantAwareCrudService<ResourceLink> {
	constructor(
		readonly typeOrmResourceLinkRepository: TypeOrmResourceLinkRepository,
		readonly mikroOrmResourceLinkRepository: MikroOrmResourceLinkRepository,
		private readonly userService: UserService,
		private readonly activityLogService: ActivityLogService
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

			// Generate the activity log
			this.activityLogService.logActivity<ResourceLink>(
				BaseEntityEnum.ResourceLink,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				resourceLink.id,
				resourceLink.title,
				resourceLink,
				resourceLink.organizationId,
				tenantId
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
			// Find Resource Link relations
			const relations = this.typeOrmResourceLinkRepository.metadata.relations.map(
				(relation) => relation.propertyName
			);

			const resourceLink = await this.findOneByIdString(id, { relations });

			if (!resourceLink) {
				throw new BadRequestException('Resource Link not found');
			}

			const updatedResourceLink = await super.create({
				...input,
				id
			});

			// Generate the activity log
			const { organizationId, tenantId } = updatedResourceLink;
			this.activityLogService.logActivity<ResourceLink>(
				BaseEntityEnum.ResourceLink,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				resourceLink.id,
				`${resourceLink.title} for ${resourceLink.entity}`,
				updatedResourceLink,
				organizationId,
				tenantId,
				resourceLink,
				input
			);

			// return updated Resource Link
			return updatedResourceLink;
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Resource Link update failed', error);
		}
	}
}
