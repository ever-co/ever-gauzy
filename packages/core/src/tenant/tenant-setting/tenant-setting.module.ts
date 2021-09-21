import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../tenant.module';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/tenant-setting', module: TenantSettingModule }
		]),
		TypeOrmModule.forFeature([ TenantSetting ]),
		TenantModule,
		CqrsModule
	],
	controllers: [TenantSettingController],
	providers: [
		TenantSettingService,
		...CommandHandlers
	],
	exports: [TenantSettingService]
})
export class TenantSettingModule {}
