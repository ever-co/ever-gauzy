import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AuthModule } from '../../auth/auth.module';
import { RolePermissionsModule } from '../../role-permissions/role-permissions.module';
import { RoleModule } from '../../role/role.module';
import { UserModule } from '../../user/user.module';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/tenant-setting', module: TenantSettingModule }
		]),
		TypeOrmModule.forFeature([TenantSetting]),
		AuthModule,
		UserModule,
		RoleModule,
		RolePermissionsModule
	],
	controllers: [TenantSettingController],
	providers: [TenantSettingService],
	exports: [TenantSettingService]
})
export class TenantSettingModule {}
