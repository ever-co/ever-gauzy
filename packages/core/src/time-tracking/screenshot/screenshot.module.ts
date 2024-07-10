import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { EventBusModule } from '../../event-bus/event-bus.module';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { Screenshot } from './screenshot.entity';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotService } from './screenshot.service';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { IntegrationTenantModule } from './../../integration-tenant/integration-tenant.module';
import { TypeOrmScreenshotRepository } from './repository/type-orm-screenshot.repository';
import { ScreenshotEventSubscriber } from './screenshot-event.subscriber';
import { ScreenshotAnalysisService } from './screenshot-analysis.service';

@Module({
	controllers: [ScreenshotController],
	imports: [
		TypeOrmModule.forFeature([Screenshot]),
		MikroOrmModule.forFeature([Screenshot]),
		GauzyAIModule.forRoot(),
		RolePermissionModule,
		TimeSlotModule,
		IntegrationTenantModule,
		CqrsModule,
		EventBusModule
	],
	providers: [
		ScreenshotService,
		ScreenshotAnalysisService,
		ScreenshotEventSubscriber,
		TypeOrmScreenshotRepository,
		...CommandHandlers
	],
	exports: [TypeOrmModule, MikroOrmModule, ScreenshotService, ScreenshotAnalysisService, TypeOrmScreenshotRepository]
})
export class ScreenshotModule {}
