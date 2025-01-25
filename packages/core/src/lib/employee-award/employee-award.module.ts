import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeAward } from './employee-award.entity';
import { EmployeeAwardController } from './employee-award.controller';
import { EmployeeAwardService } from './employee-award.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmployeeAwardRepository } from './repository/type-orm-employee-award.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeAward]),
		MikroOrmModule.forFeature([EmployeeAward]),
		RolePermissionModule
	],
	controllers: [EmployeeAwardController],
	providers: [EmployeeAwardService, TypeOrmEmployeeAwardRepository]
})
export class EmployeeAwardModule {}
