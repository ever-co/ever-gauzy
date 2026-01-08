import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { SystemSetting } from './system-setting.entity';
import { SystemSettingController } from './system-setting.controller';
import { SystemSettingService } from './system-setting.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands';
import { TypeOrmSystemSettingRepository } from './repository/type-orm-system-setting.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([SystemSetting]),
		MikroOrmModule.forFeature([SystemSetting]),
		forwardRef(() => RolePermissionModule),
		ConfigModule,
		CqrsModule
	],
	controllers: [SystemSettingController],
	providers: [SystemSettingService, TypeOrmSystemSettingRepository, ...CommandHandlers],
	exports: [SystemSettingService, TypeOrmSystemSettingRepository]
})
export class SystemSettingModule {}
