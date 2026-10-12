import { ForbiddenException, Injectable } from '@nestjs/common';
import { ID, IDeleteScreenshot, IScreenshot, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context/request-context';
import { TenantAwareCrudService } from './../../core/crud/tenant-aware-crud.service';
import { MultiORMEnum } from './../../core/utils';
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
	 * The employee the caller is acting as, for a caller who may only act on their own screenshots.
	 *
	 * A caller without `CHANGE_SELECTED_EMPLOYEE` and without an employee identity owns no screenshots, so
	 * there is nothing they may delete. Returning a null id instead would drop the ownership predicate and
	 * leave the whole organization deletable.
	 *
	 * @returns The current employee ID.
	 * @throws ForbiddenException when the request carries no employee identity.
	 */
	private ownEmployeeIdOrFail(): ID {
		const employeeId = RequestContext.currentEmployeeId();

		if (!employeeId) {
			throw new ForbiddenException('You do not have permission to delete this screenshot.');
		}
		return employeeId;
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

			let screenshot: Screenshot;

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const where: any = { id, tenantId, organizationId };

					if (!hasChangeSelectedEmployeePermission) {
						const employeeId = this.ownEmployeeIdOrFail();
						where.timeSlot = { employeeId, tenantId, organizationId };
					}

					const item = await this.mikroOrmRepository.findOneOrFail(where as any);
					screenshot = this.serialize(item) as Screenshot;
					break;
				}
				case MultiORMEnum.TypeORM:
				default: {
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
						const employeeId = this.ownEmployeeIdOrFail();

						// An INNER join, because a LEFT join keeps the row when its ON clause does not match:
						// the ownership condition would then never remove anything and any member of the
						// organization could delete any colleague's screenshot.
						query.innerJoin(
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
					screenshot = await query.getOneOrFail();
					break;
				}
			}

			// Handle force delete or soft delete based on the flag
			if (forceDelete) {
				await this.delete(screenshot.id);
				return screenshot;
			}
			return await this.softRemove(screenshot.id);
		} catch (error) {
			throw new ForbiddenException('You do not have permission to delete this screenshot.');
		}
	}
}
