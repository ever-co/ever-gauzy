import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { OrganizationVendorsService } from '../organization-vendors/organization-vendors.service';
import { OrganizationContacts } from '../organization-contacts/organization-contacts.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { UserService } from '../user/user.service';
import { UpworkTransactionService } from './upwork-transaction.service';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationContactsService } from '../organization-contacts/organization-contacts.service';
import { UpworkController } from './upwork.controller';
import { UpworkService } from './upwork.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			User,
			Employee,
			OrganizationVendor,
			OrganizationContacts,
			ExpenseCategory
		]),
		CqrsModule
	],
	controllers: [UpworkController],
	providers: [
		UpworkTransactionService,
		UpworkService,
		UserService,
		EmployeeService,
		OrganizationVendorsService,
		OrganizationContactsService,
		ExpenseCategoriesService
	]
})
export class UpworkModule {}
