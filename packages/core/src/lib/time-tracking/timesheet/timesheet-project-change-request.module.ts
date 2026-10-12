import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationProject } from './../../organization-project/organization-project.entity';
import { TypeOrmOrganizationProjectRepository } from './../../organization-project/repository/type-orm-organization-project.repository';
import { RolePermissionModule } from './../../role-permission/role-permission.module';
import { TimeLog } from './../time-log/time-log.entity';
import { TypeOrmTimeLogRepository } from './../time-log/repository/type-orm-time-log.repository';
import { Timesheet } from './timesheet.entity';
import { TypeOrmTimesheetRepository } from './repository/type-orm-timesheet.repository';
import { TimesheetProjectChangeRequest } from './timesheet-project-change-request.entity';
import { TimesheetProjectChangeRequestController } from './timesheet-project-change-request.controller';
import { TimesheetProjectChangeRequestService } from './timesheet-project-change-request.service';
import { MikroOrmTimesheetProjectChangeRequestRepository } from './repository/mikro-orm-timesheet-project-change-request.repository';
import { TypeOrmTimesheetProjectChangeRequestRepository } from './repository/type-orm-timesheet-project-change-request.repository';

/**
 * Timesheet project change request module (issue #9516).
 *
 * `Timesheet`, `TimeLog` and `OrganizationProject` are registered with `forFeature` here rather
 * than imported from their own modules so that this feature stays a leaf of the module graph and
 * cannot introduce a circular dependency into the time-tracking modules.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TimesheetProjectChangeRequest, Timesheet, TimeLog, OrganizationProject]),
		MikroOrmModule.forFeature([TimesheetProjectChangeRequest]),
		RolePermissionModule
	],
	controllers: [TimesheetProjectChangeRequestController],
	providers: [
		TimesheetProjectChangeRequestService,
		TypeOrmTimesheetProjectChangeRequestRepository,
		MikroOrmTimesheetProjectChangeRequestRepository,
		TypeOrmTimesheetRepository,
		TypeOrmTimeLogRepository,
		TypeOrmOrganizationProjectRepository
	],
	exports: [TimesheetProjectChangeRequestService]
})
export class TimesheetProjectChangeRequestModule {}
