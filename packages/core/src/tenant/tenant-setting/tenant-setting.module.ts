import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TenantModule } from './../tenant.module';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import { CommandHandlers } from './commands/handlers';
import { UserModule } from './../../user/user.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/tenant-setting', module: TenantSettingModule }]),
		TypeOrmModule.forFeature([TenantSetting]),
		MikroOrmModule.forFeature([TenantSetting]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [TenantSettingController],
	providers: [TenantSettingService, ...CommandHandlers],
	exports: [TypeOrmModule, TenantSettingService]
})
export class TenantSettingModule { }
