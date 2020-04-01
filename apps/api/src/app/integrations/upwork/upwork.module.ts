import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../user/user.entity';
import { Employee } from '../../employee/employee.entity';
import {
	OrganizationVendor,
	OrganizationVendorsService
} from '../../organization-vendors';
import { OrganizationClients } from '../../organization-clients/organization-clients.entity';
import { CqrsModule } from '@nestjs/cqrs';
import {
	ExpenseCategory,
	ExpenseCategoriesService
} from '../../expense-categories';
import { UserService } from '../../user';
import { UpworkService } from './upwork.service';
import { EmployeeService } from '../../employee/employee.service';
import { OrganizationClientsService } from '../../organization-clients/organization-clients.service';
import { UpworkController } from './upwork.controller';

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
export class UpworkModule {}
