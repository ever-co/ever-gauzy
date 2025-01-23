import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { EmployeeAvailabilityController } from './employee-availability.controller';
import { EmployeeAvailability } from './employee-availability.entity';
import { TypeOrmEmployeeAvailabilityRepository } from './repository/type-orm-employee-availability.repository';
import { MikroOrmEmployeeAvailabilityRepository } from './repository/micro-orm-employee-availability.repository';
import { EmployeeAvailabilityBulkCreateHandler, EmployeeAvailabilityCreateHandler } from './commands';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeAvailability]), MikroOrmModule.forFeature([EmployeeAvailability])],
	providers: [
		EmployeeAvailabilityService,
		TypeOrmEmployeeAvailabilityRepository,
		MikroOrmEmployeeAvailabilityRepository,
		EmployeeAvailabilityBulkCreateHandler,
		EmployeeAvailabilityCreateHandler
	],
	controllers: [EmployeeAvailabilityController]
})
export class EmployeeAvailabilityModule {}
