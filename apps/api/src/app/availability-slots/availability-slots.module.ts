import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilitySlots } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { UserModule } from '../user/user.module';

@Module({
	imports: [
		UserModule,
		TypeOrmModule.forFeature([AvailabilitySlots, Employee, Organization]),
		CqrsModule
	],
	controllers: [AvailabilitySlotsController],
	providers: [
		AvailabilitySlotsService,
		EmployeeService,
		OrganizationService,
		...CommandHandlers
	],
	exports: [AvailabilitySlotsService]
})
export class AvailabilitySlotsModule {}
