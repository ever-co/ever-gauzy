import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { IntegrationEntitySettingTiedController } from './integration-entity-setting-tied.controller';
import { IntegrationEntitySettingTiedService } from './integration-entity-setting-tied.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmIntegrationEntitySettingTiedRepository } from './repository/type-orm-integration-entity-setting-tied.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationEntitySettingTied]),
		MikroOrmModule.forFeature([IntegrationEntitySettingTied]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [IntegrationEntitySettingTiedController],
	providers: [IntegrationEntitySettingTiedService, TypeOrmIntegrationEntitySettingTiedRepository],
	exports: [IntegrationEntitySettingTiedService]
})
export class IntegrationEntitySettingTiedModule {}
