import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';
import { EventTypeController } from './event-type.controller';
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
			{ path: '/event-type', module: EventTypeModule }
		]),
		UserModule,
		TypeOrmModule.forFeature([EventType, Employee, Organization]),
		CqrsModule,
		TenantModule
	],
	controllers: [EventTypeController],
	providers: [
		EventTypeService,
		EmployeeService,
		OrganizationService,
		...CommandHandlers
	],
	exports: [EventTypeService]
})
export class EventTypeModule {}
