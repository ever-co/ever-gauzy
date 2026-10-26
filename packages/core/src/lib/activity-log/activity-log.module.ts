import { CqrsModule } from '@nestjs/cqrs';
import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLog } from './activity-log.entity';
import { ActivityLogResolver } from './activity-log.resolver';
import { ActivityLogService } from './activity-log.service';
import { EventHandlers } from './events/handlers';
import { TypeOrmActivityLogRepository } from './repository/type-orm-activity-log.repository';
import { MikroOrmActivityLogRepository } from './repository/mikro-orm-activity-log.repository';

/**
 * The activity log.
 *
 * The GraphQL view of the same resource is declared here because a resolver can only inject services
 * its own module can reach, and this module is what reaches `ActivityLogService`. Nothing has to be
 * re-exported for it: the resolver calls the service and nothing else, and the service is already
 * exported for the subscribers that write the log from outside this module.
 */
@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([ActivityLog]),
		MikroOrmModule.forFeature([ActivityLog]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [ActivityLogController],
	providers: [
		ActivityLogService,
		ActivityLogResolver,
		TypeOrmActivityLogRepository,
		MikroOrmActivityLogRepository,
		...EventHandlers
	],
	exports: [ActivityLogService, TypeOrmActivityLogRepository, MikroOrmActivityLogRepository]
})
export class ActivityLogModule {}