import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentController } from './organization-department.controller';
import { OrganizationDepartmentService } from './organization-department.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationDepartmentRepository } from './repository/type-orm-organization-department.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationDepartment]),
		MikroOrmModule.forFeature([OrganizationDepartment]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationDepartmentController],
	providers: [OrganizationDepartmentService, TypeOrmOrganizationDepartmentRepository, ...CommandHandlers],
	exports: [OrganizationDepartmentService, TypeOrmOrganizationDepartmentRepository]
})
export class OrganizationDepartmentModule {}
