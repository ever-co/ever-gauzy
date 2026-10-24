import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SaveOptions, UpdateResult } from 'typeorm';
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
import { IFindOneOptions } from '../core/crud/icrud.service';
import { LegacyFindOneOptions } from '../core/utils';
import { RequestContext } from '../core/context/request-context';
import { assertCallerIsAuthorOrTenantAdmin, isCallerTenantAdmin, withoutAuthorChange } from '../shared/ownership';
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

			// The link's author is the caller's own employee (also for CHANGE_SELECTED_EMPLOYEE holders, for whom
			// currentEmployeeId() is null), never one the body names: a caller with no employee record used to file a
			// link as written by any employee it named, and its author may change and remove it (owner decision 2,
			// 2026-10-22). Such a caller files an employee-less link, which `createdByUserId` still ties to them.
			const employeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;

			// Destructure the input data to use in entity creation
			const { ...entity } = input;

			// Validate that the employee exists — only a real id can be looked up (an empty one used to
			// match an arbitrary employee and pass vacuously); a caller with no employee identity keeps
			// creating an employee-less link, as before.
			if (employeeId) {
				const employee = await this._employeeService.findOneByIdString(employeeId);
				if (!employee) {
					throw new NotFoundException(`Employee with id ${employeeId} not found`);
				}
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

			// Only its author, or a tenant administrator, may change it ({@link assertCallerMayChange})
			this.assertCallerMayChangeLink(resourceLink);

			// Perform the update by creating a new resource link with the updated data; the patch cannot say
			// someone else wrote it
			const updatedResourceLink = await super.create({
				...withoutAuthorChange(input, ['employeeId', 'employee']),
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
			// A refused change keeps its status
			if (error instanceof ForbiddenException) {
				throw error;
			}
			// Handle any errors appropriately
			console.log(`An error occurred while updating the resource link: ${error.message}`, error);
			throw new BadRequestException('An error occurred while updating the resource link', error);
		}
	}

	/**
	 * Removes a resource link (`DELETE /resource-link/:id`, `deleteResourceLink`), if the caller wrote it or
	 * administers the tenant. A call with object criteria is a service-level call and keeps the base behaviour.
	 *
	 * @param criteria - The link's id, or criteria.
	 * @param options - Additional where conditions, passed to the base method unchanged.
	 * @returns The delete result.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<ResourceLink>,
		options?: LegacyFindOneOptions<ResourceLink>
	): Promise<DeleteResult> {
		if (typeof criteria === 'string') {
			await this.assertCallerMayChange(criteria, true);
		}

		return super.delete(criteria, options);
	}

	/**
	 * Withdraws a resource link (`DELETE /resource-link/:id/soft`, `softDeleteResourceLink`), if the caller wrote
	 * it or administers the tenant.
	 *
	 * @param id - The link to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn link.
	 */
	public async softRemove(
		id: ID,
		options?: IFindOneOptions<ResourceLink>,
		saveOptions?: SaveOptions
	): Promise<ResourceLink> {
		await this.assertCallerMayChange(id, false);

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn resource link (`PUT /resource-link/:id/recover`, `recoverResourceLink`), if the caller
	 * wrote it or administers the tenant.
	 *
	 * @param id - The link to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored link.
	 */
	public async softRecover(
		id: ID,
		options?: IFindOneOptions<ResourceLink>,
		saveOptions?: SaveOptions
	): Promise<ResourceLink> {
		await this.assertCallerMayChange(id, true);

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * Who may change a resource link: the one who wrote it — the user who created it, or the employee it names as
	 * its author (`employeeId`, stamped from the request by `create`) — or a tenant administrator (owner decision 2,
	 * 2026-10-22). The link routes state no permission, so before this any member of the tenant could rewrite,
	 * withdraw or remove another member's link; a caller without `CHANGE_SELECTED_EMPLOYEE` was held to their own
	 * employee's rows by the CRUD base, but a holder of it, or a caller with no employee record, was not.
	 *
	 * The read is the tenant-scoped one, so a link of another tenant, or one that is not there, is still a 404.
	 *
	 * @param id - The link's id.
	 * @param withDeleted - Whether a withdrawn link counts (a recovery, and a removal, act on one).
	 * @throws ForbiddenException when the caller neither wrote it nor administers the tenant.
	 */
	private async assertCallerMayChange(id: ID, withDeleted: boolean): Promise<void> {
		if (isCallerTenantAdmin()) {
			return;
		}

		this.assertCallerMayChangeLink(
			await this.findOneByIdString(id, withDeleted ? { withDeleted: true } : undefined)
		);
	}

	/**
	 * {@link assertCallerMayChange}, for a link already read.
	 *
	 * @param resourceLink - The link, as stored.
	 * @throws ForbiddenException when the caller neither wrote it nor administers the tenant.
	 */
	private assertCallerMayChangeLink(resourceLink: ResourceLink): void {
		assertCallerIsAuthorOrTenantAdmin(
			{ userId: resourceLink.createdByUserId, employeeId: resourceLink.employeeId },
			'a resource link'
		);
	}
}
