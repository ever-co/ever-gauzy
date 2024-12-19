import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { EmployeeSetting } from './employee-setting.entity';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSettingController } from './employee-setting.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/employee-settings', module: EmployeeSettingModule }]),
		TypeOrmModule.forFeature([EmployeeSetting]),
		MikroOrmModule.forFeature([EmployeeSetting]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [EmployeeSettingController],
	providers: [EmployeeSettingService, ...CommandHandlers],
	exports: [EmployeeSettingService]
})
export class EmployeeSettingModule {}
