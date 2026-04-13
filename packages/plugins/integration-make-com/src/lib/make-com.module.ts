import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@gauzy/config';
import { CqrsModule } from '@nestjs/cqrs';
import {
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	RolePermissionModule,
	UserModule
} from '@gauzy/core';
import { MakeComController } from './make-com.controller';
import { MakeComAuthorizationController } from './make-com-authorization.controller';
import { MakeComApiController } from './make-com-api.controller';
import { MakeComMiddleware } from './make-com.middleware';
import { MakeComService } from './make-com.service';
import { WebhookService } from './webhook.service';
import { EventHandlers } from './handlers';
import { MakeComOAuthService } from './make-com-oauth.service';
import { MakeComApiService } from './make-com-api.service';

@Module({
	imports: [
		HttpModule,
		ConfigModule,
		CqrsModule,
		RolePermissionModule,
		IntegrationModule,
		IntegrationSettingModule,
		IntegrationTenantModule,
		UserModule
	],
	controllers: [MakeComController, MakeComAuthorizationController, MakeComApiController],
	providers: [WebhookService, MakeComService, MakeComOAuthService, MakeComApiService, ...EventHandlers],
	exports: [WebhookService, MakeComService, MakeComOAuthService, MakeComApiService]
})
export class MakeComModule implements NestModule {
	/**
	 * Configures the middleware for the MakeCom module.
	 *
	 * @param consumer - The MiddlewareConsumer instance used to apply middleware.
	 */
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(MakeComMiddleware).forRoutes(
			{
				path: '/integration/make-com/oauth-settings',
				method: RequestMethod.POST
			},
			{
				path: '/integration/make-com/oauth-config',
				method: RequestMethod.GET
			},
			{
				path: '/integration/make-com',
				method: RequestMethod.GET
			},
			{
				path: '/integration/make-com',
				method: RequestMethod.POST
			},
			// Make.com API proxy routes
			{
				path: '/integration/make-com/api/*',
				method: RequestMethod.ALL
			}
		);
	}
}
