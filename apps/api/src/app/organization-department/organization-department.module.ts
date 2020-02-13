import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentController } from './organization-department.controller';
import { OrganizationDepartmentService } from './organization-department.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { User, UserService } from '../user';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationDepartment, User]),
		CqrsModule
	],
	controllers: [OrganizationDepartmentController],
	providers: [OrganizationDepartmentService, UserService, ...CommandHandlers],
	exports: [OrganizationDepartmentService]
})
export class OrganizationDepartmentModule {}
