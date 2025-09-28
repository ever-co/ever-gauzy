import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeHourlyRate } from '../employee-hourly-rate.entity';

@Injectable()
export class TypeOrmEmployeeHourlyRateRepository extends Repository<EmployeeHourlyRate> {
	constructor(
		@InjectRepository(EmployeeHourlyRate)
		readonly repository: Repository<EmployeeHourlyRate>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}

	async createRateChange(rate: Partial<EmployeeHourlyRate>): Promise<EmployeeHourlyRate> {
		const newRate = this.repository.create(rate);
		return this.repository.save(newRate);
	}

	async findByEmployee(employeeId: string): Promise<EmployeeHourlyRate[]> {
		return this.repository.find({ where: { employee: { id: employeeId } }, order: { lastUpdate: 'DESC' } });
	}
}
