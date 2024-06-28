import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { UpworkJobService, UpworkOffersService, UpworkReportService } from '@gauzy/integration-upwork';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from '../user/user.module';
import { RoleModule } from '../role/role.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationVendorModule } from 'organization-vendor/organization-vendor.module';
import { ExpenseCategoriesModule } from '../expense-categories/expense-categories.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationContactModule } from './../organization-contact/organization-contact.module';
import { IntegrationMapModule } from './../integration-map/integration-map.module';
import { TimeSlotModule } from '../time-tracking/time-slot/time-slot.module';
import { ExpenseModule } from './../expense/expense.module';
import { IncomeModule } from './../income/income.module';
import { UpworkAuthorizationController } from './upwork-authorization.controller';
import { UpworkController } from './upwork.controller';
import { UpworkTransactionService } from './upwork-transaction.service';
import { UpworkService } from './upwork.service';

@Module({
	imports: [
		RolePermissionModule,
		UserModule,
		EmployeeModule,
		RoleModule,
		OrganizationModule,
		OrganizationVendorModule,
		OrganizationContactModule,
		IntegrationMapModule,
		IncomeModule,
		ExpenseModule,
		ExpenseCategoriesModule,
		TimeSlotModule,
		CqrsModule
	],
	controllers: [UpworkAuthorizationController, UpworkController],
	providers: [UpworkJobService, UpworkOffersService, UpworkTransactionService, UpworkReportService, UpworkService]
})
export class UpworkModule {}
