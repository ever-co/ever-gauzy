import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeModule } from '../employee/employee.module';
import { EmployeeHourlyRate } from './employee-hourly-rate.entity';
import { TypeOrmEmployeeHourlyRateRepository } from './repository/type-orm-hourly-rates.repository';
import { MikroOrmEmployeeHourlyRateRepository } from './repository/mikro-orm-hourly-rates.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeHourlyRate]),
		MikroOrmModule.forFeature([EmployeeHourlyRate]),
		forwardRef(() => EmployeeModule)
	],
	providers: [MikroOrmEmployeeHourlyRateRepository, TypeOrmEmployeeHourlyRateRepository],
	exports: [MikroOrmEmployeeHourlyRateRepository, TypeOrmEmployeeHourlyRateRepository]
})
export class EmployeeHourlyRateModule {}
