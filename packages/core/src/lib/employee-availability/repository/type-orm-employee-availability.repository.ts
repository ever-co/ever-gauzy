import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeAvailability } from '../employee-availability.entity';

@Injectable()
export class TypeOrmEmployeeAvailabilityRepository extends Repository<EmployeeAvailability> {
	constructor(@InjectRepository(EmployeeAvailability) readonly repository: Repository<EmployeeAvailability>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
