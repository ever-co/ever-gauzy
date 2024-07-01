import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import {
	EmployeeModule,
	ExpenseCategoriesModule,
	ExpenseModule,
	IncomeModule,
	IntegrationMapModule,
	OrganizationContactModule,
	OrganizationModule,
	OrganizationVendorModule,
	RoleModule,
	RolePermissionModule,
	TimeSlotModule,
	UserModule
} from '@gauzy/core';
import { ProposalModule } from '@gauzy/plugin-job-proposal';
import { UpworkTransactionService } from './upwork-transaction.service';
import { UpworkService } from './upwork.service';
import { UpworkJobService } from './upwork-job.service';
import { UpworkOffersService } from './upwork-offers.service';
import { UpworkReportService } from './upwork-report.service';
import { UpworkAuthorizationController } from './upwork-authorization.controller';
import { UpworkController } from './upwork.controller';

@Module({
	imports: [
		EmployeeModule,
		ExpenseCategoriesModule,
		ExpenseModule,
		IncomeModule,
		IntegrationMapModule,
		OrganizationContactModule,
		OrganizationModule,
		OrganizationVendorModule,
		RoleModule,
		RolePermissionModule,
		TimeSlotModule,
		UserModule,
		ProposalModule,
		CqrsModule
	],
	controllers: [UpworkAuthorizationController, UpworkController],
	providers: [UpworkJobService, UpworkOffersService, UpworkReportService, UpworkTransactionService, UpworkService]
})
export class UpworkModule {}
