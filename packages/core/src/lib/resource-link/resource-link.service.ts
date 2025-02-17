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
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { EmployeeService } from '../employee/employee.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ResourceLink } from './resource-link.entity';
import { TypeOrmResourceLinkRepository } from './repository/type-orm-resource-link.repository';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

@Injectable()
export class ResourceLinkService extends TenantAwareCrudService<ResourceLink> {
	constructor(
		readonly typeOrmResourceLinkRepository: TypeOrmResourceLinkRepository,
		readonly mikroOrmResourceLinkRepository: MikroOrmResourceLinkRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _activityLogService: ActivityLogService
	) {
		super(typeOrmResourceLinkRepository, mikroOrmResourceLinkRepository);
	}

	/**
	 * @description Create a new Resource Link
	 * @param {IResourceLinkCreateInput} input - The data required to create a resource link.
	 * @returns A promise that resolves to the created resource link entity.
	 * @memberof ResourceLinkService
	 */
	async create(input: IResourceLinkCreateInput): Promise<IResourceLink> {
		try {
			// Retrieve the tenantId from the request context or fall back to input value
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

			// Retrieve the employeeId from the request context or fall back to input value
			const employeeId = RequestContext.currentEmployeeId() ?? input.employeeId;

			// Destructure the input data to use in entity creation
			const { ...entity } = input;

			// Validate that the employee exists.
			const employee = await this._employeeService.findOneByIdString(employeeId);
			if (!employee) {
				throw new NotFoundException(`Employee with id ${employeeId} not found`);
			}

			// Create and return the resource link, passing the necessary entity data
			const resourceLink = await super.create({
				...entity,
				employeeId,
				tenantId // Ensure tenantId is included in the entity
			});

			// Generate the activity log
			this._activityLogService.logActivity<ResourceLink>(
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
			console.log(`Error creating resource link: ${error.message}`, error);
			throw new BadRequestException('Error creating resource link', error);
		}
	}

	/**
	 * @description Update an existing Resource Link
	 * @param {ID} id - The ID of the resource link to update.
	 * @param {IResourceLinkUpdateInput} input - The data to update the resource link.
	 * @returns A promise that resolves to the updated resource link entity, or an update result.
	 * @memberof ResourceLinkService
	 */
	async update(id: ID, input: IResourceLinkUpdateInput): Promise<IResourceLink | UpdateResult> {
		try {
			// Retrieve the existing resource link by ID
			const resourceLink = await this.findOneByIdString(id);

			if (!resourceLink) {
				// If the resource link is not found, throw an exception
				throw new BadRequestException('Resource Link not found');
			}

			// Perform the update by creating a new resource link with the updated data
			const updatedResourceLink = await super.create({
				...input,
				id // Ensure the ID is passed along with the updated data
			});

			// Generate the activity log for the update action
			const { organizationId, tenantId } = updatedResourceLink;
			this._activityLogService.logActivity<ResourceLink>(
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

			// Return the updated resource link entity or update result
			return updatedResourceLink;
		} catch (error) {
			// Handle any errors appropriately
			console.log(`An error occurred while updating the resource link: ${error.message}`, error);
			throw new BadRequestException('An error occurred while updating the resource link', error);
		}
	}
}
