import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { EmployeeLevelController } from './employee-level.controller';
import { EmployeeLevelService } from './employee-level.service';
import { EmployeeLevel } from './employee-level.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/employee-level', module: EmployeeLevelModule }]),
		TypeOrmModule.forFeature([EmployeeLevel]),
		CqrsModule,
		TenantModule
	],
	controllers: [EmployeeLevelController],
	providers: [EmployeeLevelService]
})
export class EmployeeLevelModule {}
