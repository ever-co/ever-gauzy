import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeLevelController } from './employee-level.controller';
import { EmployeeLevelService } from './employee-level.service';
import { EmployeeLevel } from './employee-level.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmployeeLevelRepository } from './repository/type-orm-employee-level.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeLevel]),
		MikroOrmModule.forFeature([EmployeeLevel]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeLevelController],
	providers: [EmployeeLevelService, TypeOrmEmployeeLevelRepository]
})
export class EmployeeLevelModule {}
