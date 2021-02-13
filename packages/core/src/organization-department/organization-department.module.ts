import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentController } from './organization-department.controller';
import { OrganizationDepartmentService } from './organization-department.service';
import { CommandHandlers } from './commands/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-department',
				module: OrganizationDepartmentModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationDepartment, User]),
		CqrsModule,
		TenantModule
	],
	controllers: [OrganizationDepartmentController],
	providers: [OrganizationDepartmentService, UserService, ...CommandHandlers],
	exports: [OrganizationDepartmentService]
})
export class OrganizationDepartmentModule {}
