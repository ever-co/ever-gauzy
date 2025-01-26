import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { TypeOrmEmployeeAvailabilityRepository } from './repository/type-orm-employee-availability.repository';
import { MikroOrmEmployeeAvailabilityRepository } from './repository/micro-orm-employee-availability.repository';
import { EmployeeAvailability } from './employee-availability.entity';

@Injectable()
export class EmployeeAvailabilityService extends TenantAwareCrudService<EmployeeAvailability> {
	constructor(
		readonly typeOrmEmployeeAvailabilityRepository: TypeOrmEmployeeAvailabilityRepository,
		readonly mikroOrmEmployeeAvailabilityRepository: MikroOrmEmployeeAvailabilityRepository
	) {
		super(typeOrmEmployeeAvailabilityRepository, mikroOrmEmployeeAvailabilityRepository);
	}
}
