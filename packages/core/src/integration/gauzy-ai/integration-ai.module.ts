import { MiddlewareConsumer, Module, NestModule, RequestMethod, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { IntegrationAIController } from './integration-ai.controller';
import { IntegrationAIService } from './integration-ai.service';
import { IntegrationModule } from './../integration.module';
import { IntegrationTenantModule } from './../../integration-tenant/integration-tenant.module';
import { IntegrationAIMiddleware } from './integration-ai.middleware';
import { EmployeeJobPostController } from './../../employee-job/employee-job.controller';

@Module({
	imports: [
		TenantModule,
		UserModule,
		IntegrationTenantModule,
		GauzyAIModule.forRoot(),
		forwardRef(() => IntegrationModule),
		CqrsModule
	],
	controllers: [
		IntegrationAIController
	],
	providers: [
		IntegrationAIService,
		IntegrationAIMiddleware
	]
})
export class IntegrationAIModule implements NestModule {

	configure(consumer: MiddlewareConsumer) {
		// Apply middlewares to specific controllers
		consumer.apply(IntegrationAIMiddleware).forRoutes(
			RouterModule.resolvePath(EmployeeJobPostController) // Apply to EmployeeJobPostController
		);
		consumer.apply(IntegrationAIMiddleware).forRoutes(
			{
				path: '/employee/job-statistics',
				method: RequestMethod.GET
			},
			{
				path: '/employee/:id/job-search-status',
				method: RequestMethod.PUT
			},
			{
				path: '/job-preset',
				method: RequestMethod.POST
			},
			{
				path: '/job-preset',
				method: RequestMethod.GET
			},
			{
				path: '/job-preset/employee/:employeeId/criterion',
				method: RequestMethod.POST
			}
		); // Apply to specific routes and methods
	}
}
