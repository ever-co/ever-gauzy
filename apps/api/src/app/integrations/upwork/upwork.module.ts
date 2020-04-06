import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../user/user.entity';
import { Employee } from '../../employee/employee.entity';
import { OrganizationVendor } from '../../organization-vendors/organization-vendors.entity';
import { OrganizationVendorsService } from '../../organization-vendors/organization-vendors.service';
import { OrganizationClients } from '../../organization-clients/organization-clients.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { ExpenseCategory } from '../../expense-categories/expense-category.entity';
import { ExpenseCategoriesService } from '../../expense-categories/expense-categories.service';
import { UserService } from '../../user/user.service';
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
