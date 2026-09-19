import { Module } from '@nestjs/common';
import { EmployeeModule } from './../../employee/employee.module';
import { UserModule } from './../../user/user.module';
import { OrganizationProjectModule } from './../../organization-project/organization-project.module';
import { StatisticController } from './statistic.controller';
import { ProfileActivityController } from './profile-activity.controller';
import { StatisticResolver } from './statistic.resolver';
import { ProfileActivityResolver } from './profile-activity.resolver';
import { StatisticService } from './statistic.service';
import { TaskModule } from './../../tasks/task.module';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { ActivityModule } from './../activity/activity.module';
import { TimeLogModule } from './../time-log/time-log.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';

@Module({
	controllers: [StatisticController, ProfileActivityController],
	imports: [
		RolePermissionModule,
		OrganizationProjectModule,
		TaskModule,
		TimeSlotModule,
		EmployeeModule,
		UserModule,
		ActivityModule,
		TimeLogModule
	],
	providers: [
		StatisticService,
		// The GraphQL view of the same two surfaces: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches `StatisticService` — the
		// one dependency either resolver has. They are two resolvers rather than one because the two
		// controllers state two different truths: `StatisticController` carries a class-level permission
		// list and `ProfileActivityController` carries none, and a single class-level statement cannot
		// be both.
		StatisticResolver,
		ProfileActivityResolver
	],
	exports: [StatisticService]
})
export class StatisticModule {}
