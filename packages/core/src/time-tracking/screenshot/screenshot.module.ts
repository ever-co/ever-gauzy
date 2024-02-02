import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { TenantModule } from './../../tenant/tenant.module';
import { Screenshot } from './screenshot.entity';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotService } from './screenshot.service';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { UserModule } from './../../user/user.module';
import { IntegrationTenantModule } from './../../integration-tenant/integration-tenant.module';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	controllers: [
		ScreenshotController
	],
	imports: [
		TypeOrmModule.forFeature([Screenshot]),
		MikroOrmModule.forFeature([Screenshot]),
		GauzyAIModule.forRoot(),
		TenantModule,
		forwardRef(() => TimeSlotModule),
		forwardRef(() => UserModule),
		IntegrationTenantModule,
		CqrsModule
	],
	providers: [
		ScreenshotService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		ScreenshotService
	]
})
export class ScreenshotModule { }
