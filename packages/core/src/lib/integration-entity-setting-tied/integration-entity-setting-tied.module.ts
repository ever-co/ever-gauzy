import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { IntegrationEntitySettingTiedController } from './integration-entity-setting-tied.controller';
import { IntegrationEntitySettingTiedService } from './integration-entity-setting-tied.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/integration-entity-setting-tied',
				module: IntegrationEntitySettingTiedModule
			}
		]),
		TypeOrmModule.forFeature([IntegrationEntitySettingTied]),
		MikroOrmModule.forFeature([IntegrationEntitySettingTied]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [IntegrationEntitySettingTiedController],
	providers: [IntegrationEntitySettingTiedService],
	exports: [TypeOrmModule, MikroOrmModule, IntegrationEntitySettingTiedService]
})
export class IntegrationEntitySettingTiedModule {}
