import { ForbiddenException, Injectable } from '@nestjs/common';
import { ID, IDeleteScreenshot, IScreenshot, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context/request-context';
import { TenantAwareCrudService } from './../../core/crud/tenant-aware-crud.service';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { Screenshot } from './screenshot.entity';
import { TypeOrmScreenshotRepository } from './repository/type-orm-screenshot.repository';
import { MikroOrmScreenshotRepository } from './repository/mikro-orm-screenshot.repository';

@Injectable()
export class ScreenshotService extends TenantAwareCrudService<Screenshot> {
	constructor(
		typeOrmScreenshotRepository: TypeOrmScreenshotRepository,
		mikroOrmScreenshotRepository: MikroOrmScreenshotRepository
	) {
		super(typeOrmScreenshotRepository, mikroOrmScreenshotRepository);
	}

	/**
	 * Delete screenshot by ID
	 *
	 * @param id - The ID of the screenshot to delete
	 * @param options - Optional additional conditions for finding the screenshot
	 * @returns The deleted screenshot
	 * @throws ForbiddenException if the screenshot cannot be found or deleted
	 */
	async deleteScreenshot(id: ID, options?: IDeleteScreenshot): Promise<IScreenshot> {
		try {
			const tenantId = RequestContext.currentTenantId() ?? options.tenantId;
			const { organizationId, forceDelete } = options;

			// Check if the current user has the permission to change the selected employee
			const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);

			// Create a query builder for the Screenshot entity
			const query = this.typeOrmRepository.createQueryBuilder();

			// Add the WHERE clause to the query
			query
				.where(p(`"${query.alias}"."id" = :id`), { id })
				.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId })
				.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

			// Restrict by employeeId if the user doesn't have permission
			if (!hasChangeSelectedEmployeePermission) {
				// Get the current employee ID from the request context
				const employeeId = RequestContext.currentEmployeeId();

				// Join the timeSlot table and filter by employeeId, tenantId, and organizationId
				query.leftJoin(
					`${query.alias}.timeSlot`,
					'time_slot',
					'time_slot.employeeId = :employeeId AND time_slot.tenantId = :tenantId AND time_slot.organizationId = :organizationId',
					{
						employeeId,
						tenantId,
						organizationId
					}
				);
			}

			// Find the screenshot
			const screenshot = await query.getOneOrFail();

			// Handle force delete or soft delete based on the flag
			return forceDelete
				? await this.typeOrmRepository.remove(screenshot)
				: await this.typeOrmRepository.softRemove(screenshot);
		} catch (error) {
			throw new ForbiddenException('You do not have permission to delete this screenshot.');
		}
	}
}
