import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationVendorsService } from '../organization-vendors/organization-vendors.service';
import { CqrsModule } from '@nestjs/cqrs';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { UserService } from '../user/user.service';
import { UpworkTransactionService } from './upwork-transaction.service';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { UpworkController } from './upwork.controller';
import { UpworkService } from './upwork.service';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { OrganizationService } from '../organization/organization.service';
import { RoleService } from '../role/role.service';
import { TimeSlotService } from '../timesheet/time-slot/time-slot.service';
import { ExportAllModule } from '../export-import/export/export-all.module';
import {
	UpworkJobService,
	UpworkOffersService
} from '@gauzy/integration-upwork';
import { RouterModule } from 'nest-router';
import { Activity, Employee, ExpenseCategory, IntegrationMap, Organization, OrganizationContact, OrganizationVendor, Role, TimeLog, TimeSlot, TimeSlotMinute, User } from './../core/entities/internal';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integrations/upwork', module: UpworkModule }
		]),
		TypeOrmModule.forFeature([
			User,
			Employee,
			OrganizationVendor,
			OrganizationContact,
			ExpenseCategory,
			IntegrationMap,
			Organization,
			Role,
			TimeSlot,
			Activity,
			TimeLog,
			TimeSlotMinute
		]),
		CqrsModule,
		ExportAllModule
	],
	controllers: [UpworkController],
	providers: [
		UpworkJobService,
		UpworkOffersService,
		UpworkTransactionService,
		UpworkService,
		UserService,
		EmployeeService,
		OrganizationVendorsService,
		OrganizationContactService,
		ExpenseCategoriesService,
		IntegrationMapService,
		OrganizationService,
		RoleService,
		TimeSlotService
	]
})
export class UpworkModule {}
