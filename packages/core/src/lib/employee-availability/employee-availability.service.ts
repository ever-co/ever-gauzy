import { Injectable } from '@nestjs/common';
import { TypeOrmEmployeeAvailabilityRepository } from './repository/type-orm-employee-availability.repository';
import { MikroOrmEmployeeAvailabilityRepository } from './repository/micro-orm-employee-availability.repository';
import { EmployeeAvailability, TenantAwareCrudService } from '../core';

@Injectable()
export class EmployeeAvailabilityService extends TenantAwareCrudService<EmployeeAvailability> {
	constructor(
		typeOrmEmployeeAvailabilityRepository: TypeOrmEmployeeAvailabilityRepository,
		mikroOrmEmployeeAvailabilityRepository: MikroOrmEmployeeAvailabilityRepository
	) {
		super(typeOrmEmployeeAvailabilityRepository, mikroOrmEmployeeAvailabilityRepository);
	}
}
