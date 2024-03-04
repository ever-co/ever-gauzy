import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeLevelController } from './employee-level.controller';
import { EmployeeLevelService } from './employee-level.service';
import { EmployeeLevel } from './employee-level.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/employee-level', module: EmployeeLevelModule }]),
		TypeOrmModule.forFeature([EmployeeLevel]),
		MikroOrmModule.forFeature([EmployeeLevel]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeLevelController],
	providers: [EmployeeLevelService]
})
export class EmployeeLevelModule { }
