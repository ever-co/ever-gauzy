import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { CommandHandlers } from './commands/handlers';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/availability-slots', module: AvailabilitySlotsModule }
		]),
		UserModule,
		TypeOrmModule.forFeature([AvailabilitySlot, Employee, Organization]),
		CqrsModule,
		TenantModule
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
