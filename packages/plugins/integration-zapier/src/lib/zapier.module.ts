import { Module } from '@nestjs/common';
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
import { ZapierController } from './zapier.controller';
import { ZapierService } from './zapier.service';

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
	controllers: [ZapierController],
	providers: [ZapierService],
	exports: []
})
export class ZapierModule {}
