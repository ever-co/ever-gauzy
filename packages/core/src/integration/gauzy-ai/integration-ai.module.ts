import { MiddlewareConsumer, Module, NestModule, RequestMethod, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { IntegrationModule } from './../integration.module';
import { IntegrationTenantModule } from './../../integration-tenant/integration-tenant.module';
import { IntegrationSettingModule } from '../../integration-setting/integration-setting.module';
import { IntegrationAIController } from './integration-ai.controller';
import { IntegrationAIService } from './integration-ai.service';
import { IntegrationAIMiddleware } from './integration-ai.middleware';

@Module({
	imports: [
		TenantModule,
		UserModule,
		IntegrationTenantModule,
		GauzyAIModule.forRoot(),
		forwardRef(() => IntegrationModule),
		CqrsModule
	],
	controllers: [IntegrationAIController],
	providers: [IntegrationAIService, IntegrationAIMiddleware]
})
export class IntegrationAIModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(IntegrationAIMiddleware).forRoutes(
			{
				path: '/employee-job',
				method: RequestMethod.GET
			},
			{
				path: '/employee-job/apply',
				method: RequestMethod.POST
			},
			{
				path: '/employee-job/updateApplied',
				method: RequestMethod.POST
			},
			{
				path: '/employee-job/hide',
				method: RequestMethod.POST
			},
			{
				path: '/employee-job/pre-process',
				method: RequestMethod.POST
			},
			{
				path: '/employee-job/application/:employeeJobApplicationId',
				method: RequestMethod.GET
			},
			{
				path: '/employee-job/generate-proposal/:employeeJobApplicationId',
				method: RequestMethod.POST
			},
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
			},
			{
				path: '/timesheet/screenshot',
				method: RequestMethod.POST
			}
		);
	}
}
