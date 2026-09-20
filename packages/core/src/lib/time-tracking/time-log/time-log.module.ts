import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { EmployeeModule } from './../../employee/employee.module';
import { OrganizationProjectModule } from './../../organization-project/organization-project.module';
import { OrganizationContactModule } from './../../organization-contact/organization-contact.module';
import { CommandHandlers } from './commands/handlers';
import { Organization } from './../../organization/organization.entity';
import { TypeOrmOrganizationRepository } from './../../organization/repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from './../../organization/repository/mikro-orm-organization.repository';
import { TimeLog } from './time-log.entity';
import { TimeLogController } from './time-log.controller';
import { TimeLogService } from './time-log.service';
import { TimeLogResolver } from './time-log.resolver';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { MikroOrmTimeLogRepository } from './repository/mikro-orm-time-log.repository';

@Module({
	controllers: [TimeLogController],
	imports: [
		// `Organization` is registered here so that `OrganizationPermissionGuard`, which this
		// controller applies, can read the organization time-tracking policy columns.
		TypeOrmModule.forFeature([TimeLog, Organization]),
		MikroOrmModule.forFeature([TimeLog, Organization]),
		RolePermissionModule,
		forwardRef(() => EmployeeModule),
		forwardRef(() => OrganizationProjectModule),
		forwardRef(() => OrganizationContactModule),
		forwardRef(() => TimeSlotModule),
		CqrsModule
	],
	providers: [
		TimeLogService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them — the service every
		// field calls, and the command bus the conflict read and the three writes dispatch through.
		TimeLogResolver,
		TypeOrmTimeLogRepository,
		MikroOrmTimeLogRepository,
		TypeOrmOrganizationRepository,
		MikroOrmOrganizationRepository,
		...CommandHandlers
	],
	exports: [TimeLogService, TypeOrmTimeLogRepository, MikroOrmTimeLogRepository]
})
export class TimeLogModule {}
