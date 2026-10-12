import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { OfficialHoliday } from './official-holiday.entity';
import { OfficialHolidayController } from './official-holiday.controller';
import { OfficialHolidayService } from './official-holiday.service';
import { MikroOrmOfficialHolidayRepository } from './repository/mikro-orm-official-holiday.repository';
import { TypeOrmOfficialHolidayRepository } from './repository/type-orm-official-holiday.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OfficialHoliday]),
		MikroOrmModule.forFeature([OfficialHoliday]),
		RolePermissionModule
	],
	controllers: [OfficialHolidayController],
	providers: [OfficialHolidayService, TypeOrmOfficialHolidayRepository, MikroOrmOfficialHolidayRepository],
	exports: [OfficialHolidayService, TypeOrmOfficialHolidayRepository, MikroOrmOfficialHolidayRepository]
})
export class OfficialHolidayModule {}
