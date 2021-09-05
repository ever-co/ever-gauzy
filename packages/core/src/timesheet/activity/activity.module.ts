import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from './../../tenant/tenant.module';
import { EmployeeModule } from './../../employee/employee.module';
import { OrganizationProjectModule } from './../../organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { Activity } from './activity.entity';
import { ActivityMapService } from './activity.map.service';

@Module({
	controllers: [
		ActivityController
	],
	imports: [
		TypeOrmModule.forFeature([ Activity ]),
		TenantModule,
		EmployeeModule,
		OrganizationProjectModule,
		CqrsModule
	],
	providers: [
		ActivityService,
		ActivityMapService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		ActivityService,
		ActivityMapService
	]
})
export class ActivityModule {}
