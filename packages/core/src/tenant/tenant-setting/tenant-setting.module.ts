import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/tenant-setting', module: TenantSettingModule }
		]),
		TypeOrmModule.forFeature([ TenantSetting ])
	],
	controllers: [TenantSettingController],
	providers: [TenantSettingService],
	exports: [TenantSettingService]
})
export class TenantSettingModule {}
