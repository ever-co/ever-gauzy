import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationVendorModule } from 'organization-vendor/organization-vendor.module';
import { CqrsModule } from '@nestjs/cqrs';
import { ExpenseCategoriesModule } from '../expense-categories/expense-categories.module';
import { UserModule } from '../user/user.module';
import { UpworkTransactionService } from './upwork-transaction.service';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationContactModule } from './../organization-contact/organization-contact.module';
import { UpworkController } from './upwork.controller';
import { UpworkService } from './upwork.service';
import { IntegrationMapModule } from './../integration-map/integration-map.module';
import { OrganizationModule } from '../organization/organization.module';
import { RoleModule } from '../role/role.module';
import { TimeSlotService } from '../time-tracking/time-slot/time-slot.service';
import { ExpenseModule } from './../expense/expense.module';
import { IncomeModule } from './../income/income.module';
import {
	UpworkJobService,
	UpworkOffersService,
	UpworkReportService
} from '@gauzy/integration-upwork';
import { RouterModule } from 'nest-router';
import {
	Activity,
	TimeLog,
	TimeSlot,
	TimeSlotMinute
} from './../core/entities/internal';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integrations/upwork', module: UpworkModule }
		]),
		TypeOrmModule.forFeature([
			TimeSlot,
			Activity,
			TimeLog,
			TimeSlotMinute
		]),
		UserModule,
		EmployeeModule,
		RoleModule,
		OrganizationModule,
		OrganizationVendorModule,
		OrganizationContactModule,
		IntegrationMapModule,
		ExpenseModule,
		IncomeModule,
		ExpenseCategoriesModule,
		CqrsModule
	],
	controllers: [UpworkController],
	providers: [
		UpworkJobService,
		UpworkOffersService,
		UpworkTransactionService,
		UpworkReportService,
		UpworkService,
		TimeSlotService
	]
})
export class UpworkModule {}
