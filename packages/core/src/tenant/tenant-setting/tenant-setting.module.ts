import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/tenant-setting', module: TenantSettingModule }]),
		TypeOrmModule.forFeature([TenantSetting]),
		MikroOrmModule.forFeature([TenantSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TenantSettingController],
	providers: [TenantSettingService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, TenantSettingService]
})
export class TenantSettingModule { }
