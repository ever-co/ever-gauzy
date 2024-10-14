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
	providers: [ApiCallLogService, ApiCallLogMiddleware, TypeOrmApiCallLogRepository],
	exports: [ApiCallLogService]
})
export class ApiCallLogModule implements NestModule {
	/**
	 * Configures the middleware for Time Tracking routes (POST, PUT, PATCH, DELETE).
	 *
	 * @param consumer The middleware consumer used to apply the middleware to specific routes.
	 */
	configure(consumer: MiddlewareConsumer) {
		consumer
			.apply(ApiCallLogMiddleware)
			.forRoutes(
				{ path: '/timesheet/(.*)', method: RequestMethod.POST },
				{ path: '/timesheet/(.*)', method: RequestMethod.PUT },
				{ path: '/timesheet/(.*)', method: RequestMethod.DELETE }
			);
	}
}
