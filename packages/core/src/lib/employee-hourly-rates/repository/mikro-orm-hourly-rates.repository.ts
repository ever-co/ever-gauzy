import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmployeeHourlyRate } from '../employee-hourly-rate.entity';

@Injectable()
export class MikroOrmEmployeeHourlyRateRepository extends MikroOrmBaseEntityRepository<EmployeeHourlyRate> {
	/**
	 * Get hourly rate history for a specific employee
	 */
	async findByEmployee(employeeId: string): Promise<EmployeeHourlyRate[]> {
		return this.find({ employee: { id: employeeId } }, { orderBy: { lastUpdate: 'DESC' } });
	}
}
