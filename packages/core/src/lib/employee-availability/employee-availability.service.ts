import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IEmployeeAvailability } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { TypeOrmEmployeeAvailabilityRepository } from './repository/type-orm-employee-availability.repository';
import { MikroOrmEmployeeAvailabilityRepository } from './repository/mikro-orm-employee-availability.repository';
import { EmployeeAvailability } from './employee-availability.entity';

@Injectable()
export class EmployeeAvailabilityService extends TenantAwareCrudService<EmployeeAvailability> {
	constructor(
		readonly typeOrmEmployeeAvailabilityRepository: TypeOrmEmployeeAvailabilityRepository,
		readonly mikroOrmEmployeeAvailabilityRepository: MikroOrmEmployeeAvailabilityRepository
	) {
		super(typeOrmEmployeeAvailabilityRepository, mikroOrmEmployeeAvailabilityRepository);
	}

	/**
	 * Bulk creates new employee availability records while ensuring each entity has `tenantId`.
	 * Supports both TypeORM & MikroORM.
	 *
	 * @param entities List of employee availability objects to create.
	 * @returns Promise<IEmployeeAvailability[]> List of created employee availability records.
	 */
	public async bulkCreate(entities: Partial<EmployeeAvailability>[]): Promise<IEmployeeAvailability[]> {
		const tenantId = RequestContext.currentTenantId();

		// Prepare entities ensuring `tenantId` is assigned
		const items = entities.map(
			(entity) =>
				new EmployeeAvailability({
					...entity,
					tenantId
				})
		);

		try {
			// Use base class createMany which handles both ORMs and tenant scoping
			return await this.createMany(items);
		} catch (error) {
			throw new HttpException(
				`Error in bulkCreate method of employee availability: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
