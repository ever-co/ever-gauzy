import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { EmployeeSetting } from './employee-setting.entity';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSettingController } from './employee-setting.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/employee-settings', module: EmployeeSettingModule }
		]),
		TypeOrmModule.forFeature([EmployeeSetting]),
		TenantModule
	],
	controllers: [EmployeeSettingController],
	providers: [EmployeeSettingService],
	exports: [EmployeeSettingService]
})
export class EmployeeSettingModule {}
