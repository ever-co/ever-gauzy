import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { EmployeeLevelController } from './employee-level.controller';
import { EmployeeLevelService } from './employee-level.service';
import { EmployeeLevel } from './employee-level.entity';
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
