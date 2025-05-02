import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
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
import { MakeComMiddleware } from './make-com.middleware';
import { MakeComService } from './make-com.service';
import { WebhookService } from './webhook.service';
import { EventHandlers } from './handlers';
import { MakeComOAuthService } from './make-com-oauth.service';

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
	controllers: [MakeComController, MakeComAuthorizationController],
	providers: [WebhookService, MakeComService, MakeComOAuthService, ...EventHandlers],
	exports: [WebhookService, MakeComService, MakeComOAuthService]
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
			}
		);
	}
}
