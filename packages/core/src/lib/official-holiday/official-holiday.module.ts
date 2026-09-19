import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { OfficialHoliday } from './official-holiday.entity';
import { OfficialHolidayController } from './official-holiday.controller';
import { OfficialHolidayResolver } from './official-holiday.resolver';
import { OfficialHolidayService } from './official-holiday.service';
import { MikroOrmOfficialHolidayRepository } from './repository/mikro-orm-official-holiday.repository';
import { TypeOrmOfficialHolidayRepository } from './repository/type-orm-official-holiday.repository';

/**
 * The official holiday calendar.
 *
 * The resolver is declared here, beside the service it calls: a resolver is an ordinary Nest provider
 * and can only inject what the module hosting it can reach. It adds one provider and no import.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OfficialHoliday]),
		MikroOrmModule.forFeature([OfficialHoliday]),
		RolePermissionModule
	],
	controllers: [OfficialHolidayController],
	providers: [
		OfficialHolidayService,
		// The GraphQL view of the same resource.
		OfficialHolidayResolver,
		TypeOrmOfficialHolidayRepository,
		MikroOrmOfficialHolidayRepository
	],
	exports: [OfficialHolidayService, TypeOrmOfficialHolidayRepository, MikroOrmOfficialHolidayRepository]
})
export class OfficialHolidayModule {}
