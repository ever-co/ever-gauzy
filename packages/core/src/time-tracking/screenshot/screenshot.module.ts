import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { i4netAIModule } from '@gauzy/integration-ai';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { Screenshot } from './screenshot.entity';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotService } from './screenshot.service';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { IntegrationTenantModule } from './../../integration-tenant/integration-tenant.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	controllers: [
		ScreenshotController
	],
	imports: [
		TypeOrmModule.forFeature([Screenshot]),
		MikroOrmModule.forFeature([Screenshot]),
		i4netAIModule.forRoot(),
		RolePermissionModule,
		forwardRef(() => TimeSlotModule),
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
