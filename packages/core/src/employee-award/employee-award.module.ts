import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeAward } from './employee-award.entity';
import { EmployeeAwardController } from './employee-award.controller';
import { EmployeeAwardService } from './employee-award.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/employee-award', module: EmployeeAwardModule }]),
		TypeOrmModule.forFeature([EmployeeAward]),
		MikroOrmModule.forFeature([EmployeeAward]),
		TenantModule,
		RolePermissionModule,
		UserModule
	],
	controllers: [EmployeeAwardController],
	providers: [EmployeeAwardService]
})
export class EmployeeAwardModule { }
