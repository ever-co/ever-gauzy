import { ForbiddenException, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID, IScreenshot, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TenantAwareCrudService } from './../../core/crud';
import { Screenshot } from './screenshot.entity';
import { MikroOrmScreenshotRepository, TypeOrmScreenshotRepository } from './repository';

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
	async deleteScreenshot(id: ID, options?: FindOptionsWhere<Screenshot>): Promise<IScreenshot> {
		try {
			const tenantId = RequestContext.currentTenantId() || options?.tenantId;
			const { organizationId } = options || {};

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.setFindOptions({
				where: {
					...(options ? options : {}),
					id,
					tenantId,
					organizationId
				}
			});

			if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				const employeeId = RequestContext.currentEmployeeId();
				query.leftJoin(
					`${query.alias}.timeSlot`,
					'time_slot',
					'time_slot.employeeId = :employeeId AND time_slot.tenantId = :tenantId',
					{ employeeId, tenantId }
				);
			}

			const screenshot = await query.getOneOrFail();
			return await this.typeOrmRepository.remove(screenshot);
		} catch (error) {
			throw new ForbiddenException('You do not have permission to delete this screenshot.');
		}
	}
}
