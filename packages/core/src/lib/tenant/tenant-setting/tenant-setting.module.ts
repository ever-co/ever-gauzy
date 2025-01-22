import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTenantSettingRepository } from './repository/type-orm-tenant-setting.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TenantSetting]),
		MikroOrmModule.forFeature([TenantSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TenantSettingController],
	providers: [TenantSettingService, TypeOrmTenantSettingRepository, ...CommandHandlers],
	exports: [TenantSettingService, TypeOrmTenantSettingRepository]
})
export class TenantSettingModule {}
