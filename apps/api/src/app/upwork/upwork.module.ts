import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { OrganizationVendorsService } from '../organization-vendors/organization-vendors.service';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { UserService } from '../user/user.service';
import { UpworkTransactionService } from './upwork-transaction.service';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { UpworkController } from './upwork.controller';
import { UpworkService } from './upwork.service';
import { IntegrationMap } from '../integration-map/integration-map.entity';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { Role } from '../role/role.entity';
import { RoleService } from '../role/role.service';
import { TimeSlotService } from '../timesheet/time-slot/time-slot.service';
import { TimeSlot } from '../timesheet/time-slot.entity';
import { TimeSlotMinute } from '../timesheet/time-slot-minute.entity';
import { ExportAllModule } from '../export_import/export-all.module';

@Module({
	imports: [
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
			TimeSlotMinute
		]),
		CqrsModule,
		ExportAllModule
	],
	controllers: [UpworkController],
	providers: [
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
