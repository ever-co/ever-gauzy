import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { IntegrationEntitySettingTiedController } from './integration-entity-setting-tied.controller';
import { IntegrationEntitySettingTiedService } from './integration-entity-setting-tied.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/integration-entity-setting-tied',
				module: IntegrationEntitySettingTiedModule
			}
		]),
		TypeOrmModule.forFeature([
			IntegrationEntitySettingTied
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [
		IntegrationEntitySettingTiedController
	],
	providers: [
		IntegrationEntitySettingTiedService
	],
	exports: [
		TypeOrmModule,
		IntegrationEntitySettingTiedService
	]
})
export class IntegrationEntitySettingTiedModule { }
