import { Module } from '@nestjs/common';
import { UpworkController } from './upwork/upwork.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import { EmployeeService, Employee } from '../employee';
import { CqrsModule } from '@nestjs/cqrs';
import {
	OrganizationVendorsService,
	OrganizationVendor
} from '../organization-vendors';
import {
	OrganizationClientsService,
	OrganizationClients
} from '../organization-clients';
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
