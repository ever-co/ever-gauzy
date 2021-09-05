import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from './../../tenant/tenant.module';
import { Screenshot } from './screenshot.entity';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotService } from './screenshot.service';

@Module({
	controllers: [
		ScreenshotController
	],
	imports: [
		TypeOrmModule.forFeature([ Screenshot ]),
		TenantModule,
		CqrsModule
	],
	providers: [
		ScreenshotService
	],
	exports: [
		TypeOrmModule,
		ScreenshotService
	]
})
export class ScreenshotModule {}
