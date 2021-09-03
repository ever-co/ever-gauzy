import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { CommandHandlers } from './commands/handlers';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationModule } from './../organization/organization.module';
import { UserModule } from './../user/user.module';
import { TenantModule } from './../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/availability-slots', module: AvailabilitySlotsModule }
		]),
		UserModule,
		TypeOrmModule.forFeature([
			AvailabilitySlot
		]),
		CqrsModule,
		TenantModule,
		EmployeeModule,
		OrganizationModule
	],
	controllers: [AvailabilitySlotsController],
	providers: [
		AvailabilitySlotsService,
		...CommandHandlers
	],
	exports: [AvailabilitySlotsService]
})
export class AvailabilitySlotsModule {}
