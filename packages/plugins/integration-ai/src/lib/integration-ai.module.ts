import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IntegrationModule, IntegrationTenantModule, PluginCommonModule, RolePermissionModule } from '@gauzy/core';
import { GauzyAIModule } from './gauzy-ai.module';
import { IntegrationAIController } from './integration-ai.controller';
import { IntegrationAIService } from './integration-ai.service';
import { IntegrationAIMiddleware } from './integration-ai.middleware';
import { IntegrationAIEventSubscriber } from './integration-ai-event.subscriber';
import { IntegrationAIAnalysisService } from './integration-ai-analysis.service';

@Module({
	controllers: [IntegrationAIController],
	imports: [
		RolePermissionModule,
		IntegrationTenantModule,
		IntegrationModule,
		GauzyAIModule.forRoot(),
		PluginCommonModule,
		CqrsModule
	],
	providers: [
		IntegrationAIService,
		IntegrationAIAnalysisService,
		IntegrationAIMiddleware,
		IntegrationAIEventSubscriber
	]
})
export class IntegrationAIModule implements NestModule {
	/**
	 * Configures middleware for specific routes and methods.
	 * @param consumer The middleware consumer to apply middleware to routes.
	 */
	configure(consumer: MiddlewareConsumer): void {
		consumer
			.apply(IntegrationAIMiddleware)
			.forRoutes(
				{ path: '/employee-job', method: RequestMethod.GET },
				{ path: '/employee-job/apply', method: RequestMethod.POST },
				{ path: '/employee-job/updateApplied', method: RequestMethod.POST },
				{ path: '/employee-job/hide', method: RequestMethod.POST },
				{ path: '/employee-job/pre-process', method: RequestMethod.POST },
				{ path: '/employee-job/application/:employeeJobApplicationId', method: RequestMethod.GET },
				{ path: '/employee-job/generate-proposal/:employeeJobApplicationId', method: RequestMethod.POST },
				{ path: '/employee-job/statistics', method: RequestMethod.GET },
				{ path: '/employee-job/:id/job-search-status', method: RequestMethod.PUT },
				{ path: '/job-preset', method: RequestMethod.POST },
				{ path: '/job-preset', method: RequestMethod.GET },
				{ path: '/job-preset/employee/:employeeId/criterion', method: RequestMethod.POST },
				{ path: '/timesheet/screenshot', method: RequestMethod.POST }
			);
	}
}
