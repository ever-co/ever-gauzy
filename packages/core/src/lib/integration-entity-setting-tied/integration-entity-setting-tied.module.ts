import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { IntegrationEntitySettingTiedController } from './integration-entity-setting-tied.controller';
import { IntegrationEntitySettingTiedService } from './integration-entity-setting-tied.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationEntitySettingTied]),
		MikroOrmModule.forFeature([IntegrationEntitySettingTied]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [IntegrationEntitySettingTiedController],
	providers: [IntegrationEntitySettingTiedService],
	exports: [IntegrationEntitySettingTiedService]
})
export class IntegrationEntitySettingTiedModule {}
