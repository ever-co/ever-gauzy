import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from './../../tenant/tenant.module';
import { Screenshot } from './screenshot.entity';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotService } from './screenshot.service';
import { CommandHandlers } from './commands/handlers';
import { TimeSlotModule } from './../time-slot/time-slot.module';

@Module({
	controllers: [
		ScreenshotController
	],
	imports: [
		TypeOrmModule.forFeature([ Screenshot ]),
		TenantModule,
		forwardRef(() => TimeSlotModule),
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
export class ScreenshotModule {}
