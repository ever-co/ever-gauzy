import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { IResourceLink, IResourceLinkCreateInput, IResourceLinkUpdateInput, ID } from '@gauzy/contracts';
import { UserService } from '../user/user.service';
import { ResourceLink } from './resource-link.entity';
import { TypeOrmResourceLinkRepository } from './repository/type-orm-resource-link.repository';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

@Injectable()
export class ResourceLinkService extends TenantAwareCrudService<ResourceLink> {
	constructor(
		readonly typeOrmResourceLinkRepository: TypeOrmResourceLinkRepository,
		readonly mikroOrmResourceLinkRepository: MikroOrmResourceLinkRepository,
		private readonly userService: UserService
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
			return await super.create({
				...entity,
				tenantId,
				creatorId: user.id
			});
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

			return await super.create({
				...input,
				id
			});
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Resource Link update failed', error);
		}
	}
}
