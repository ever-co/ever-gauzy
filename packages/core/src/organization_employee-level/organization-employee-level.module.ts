import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { EmployeeLevelController } from './organization-employee-level.controller';
import { EmployeeLevelService } from './organization-employee-level.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeLevel } from './organization-employee-level.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/employee-level', module: EmployeeLevelModule }
		]),
		TypeOrmModule.forFeature([EmployeeLevel]),
		CqrsModule,
		TenantModule
	],
	controllers: [EmployeeLevelController],
	providers: [EmployeeLevelService]
})
export class EmployeeLevelModule {}
