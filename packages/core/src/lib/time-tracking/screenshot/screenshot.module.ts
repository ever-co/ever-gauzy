import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule } from '../../event-bus/event-bus.module';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { Screenshot } from './screenshot.entity';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotService } from './screenshot.service';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { IntegrationTenantModule } from './../../integration-tenant/integration-tenant.module';
import { TypeOrmScreenshotRepository } from './repository/type-orm-screenshot.repository';

@Module({
	controllers: [ScreenshotController],
	imports: [
		TypeOrmModule.forFeature([Screenshot]),
		MikroOrmModule.forFeature([Screenshot]),
		RolePermissionModule,
		TimeSlotModule,
		IntegrationTenantModule,
		CqrsModule,
		EventBusModule
	],
	providers: [ScreenshotService, TypeOrmScreenshotRepository, ...CommandHandlers],
	exports: [ScreenshotService, TypeOrmScreenshotRepository]
})
export class ScreenshotModule {}
