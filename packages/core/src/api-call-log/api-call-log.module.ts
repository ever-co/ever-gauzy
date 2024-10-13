import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ApiCallLogController } from './api-call-log.controller';
import { ApiCallLog } from './api-call-log.entity';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLogMiddleware } from './api-call-log-middleware';
import { TypeOrmApiCallLogRepository } from './repository/type-orm-api-call-log.repository';

@Module({
	imports: [TypeOrmModule.forFeature([ApiCallLog]), MikroOrmModule.forFeature([ApiCallLog]), RolePermissionModule],
	controllers: [ApiCallLogController],
	providers: [ApiCallLogService, TypeOrmApiCallLogRepository],
	exports: [ApiCallLogService]
})
export class ApiCallLogModule implements NestModule {
	/**
	 * Configures the middleware for Time Tracking routes (POST, PUT, PATCH, DELETE).
	 *
	 * @param consumer The middleware consumer used to apply the middleware to specific routes.
	 */
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(ApiCallLogMiddleware).forRoutes(
			// POST Routes
			{ path: '/timesheet/timer/toggle', method: RequestMethod.POST },
			{ path: '/timesheet/timer/start', method: RequestMethod.POST },
			{ path: '/timesheet/timer/stop', method: RequestMethod.POST },
			{ path: '/timesheet/time-log', method: RequestMethod.POST },
			{ path: '/timesheet/activity/bulk', method: RequestMethod.POST },
			{ path: '/timesheet/time-slot', method: RequestMethod.POST },
			{ path: '/timesheet/screenshot', method: RequestMethod.POST },

			// PUT Routes
			{ path: '/timesheet/time-log/:id', method: RequestMethod.PUT },
			{ path: '/timesheet/time-slot/:id', method: RequestMethod.PUT },
			{ path: '/timesheet/status', method: RequestMethod.PUT },
			{ path: '/timesheet/submit', method: RequestMethod.PUT },
			{ path: '/integration-entity-setting/integration/:id', method: RequestMethod.PUT },

			// DELETE Routes
			{ path: '/timesheet/time-log', method: RequestMethod.DELETE },
			{ path: '/timesheet/time-slot', method: RequestMethod.DELETE },
			{ path: '/timesheet/screenshot/:id', method: RequestMethod.DELETE }
		);
	}
}
