import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { EmployeeAvailabilityController } from './employee-availability.controller';
import { EmployeeAvailability } from './employee-availability.entity';
import { TypeOrmEmployeeAvailabilityRepository } from './repository/type-orm-employee-availability.repository';
import { MikroOrmEmployeeAvailabilityRepository } from './repository/micro-orm-employee-availability.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeAvailability]),
		MikroOrmModule.forFeature([EmployeeAvailability]),
		CqrsModule
	],
	providers: [
		EmployeeAvailabilityService,
		TypeOrmEmployeeAvailabilityRepository,
		MikroOrmEmployeeAvailabilityRepository,
		...CommandHandlers
	],
	controllers: [EmployeeAvailabilityController]
})
export class EmployeeAvailabilityModule {}
