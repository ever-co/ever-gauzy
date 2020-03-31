import { Module } from '@nestjs/common';
import { UpworkController } from './upwork/upwork.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { CqrsModule } from '@nestjs/cqrs';
import {
	OrganizationVendorsService,
	OrganizationVendor
} from '../organization-vendors';
import { OrganizationClientsService } from '../organization-clients/organization-clients.service';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import {
	ExpenseCategory,
	ExpenseCategoriesService
} from '../expense-categories';
import { UpworkService } from './upwork/upwork.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			User,
			Employee,
			OrganizationVendor,
			OrganizationClients,
			ExpenseCategory
		]),
		CqrsModule
	],
	controllers: [UpworkController],
	providers: [
		UpworkService,
		UserService,
		EmployeeService,
		OrganizationVendorsService,
		OrganizationClientsService,
		ExpenseCategoriesService
	]
})
export class IntegrationsModule {}
