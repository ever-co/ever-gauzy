import { Module } from '@nestjs/common';
import { EmployeeModule } from './../../employee/employee.module';
import { OrganizationProjectModule } from './../../organization-project/organization-project.module';
import { StatisticController } from './statistic.controller';
import { StatisticService } from './statistic.service';
import { TaskModule } from './../../tasks/task.module';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { ActivityModule } from './../activity/activity.module';
import { TimeLogModule } from './../time-log/time-log.module';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';

@Module({
	controllers: [
		StatisticController
	],
	imports: [
		TenantModule,
		UserModule,
		OrganizationProjectModule,
		TaskModule,
		TimeSlotModule,
		EmployeeModule,
		ActivityModule,
		TimeLogModule,
	],
	providers: [
        StatisticService
    ],
	exports: [
        StatisticService
    ]
})
export class StatisticModule {}
