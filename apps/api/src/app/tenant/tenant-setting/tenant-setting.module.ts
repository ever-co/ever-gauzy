import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';

@Module({
	imports: [TypeOrmModule.forFeature([TenantSetting])],
	controllers: [TenantSettingController],
	providers: [TenantSettingService],
	exports: [TenantSettingService]
})
export class TenantSettingModule {}
