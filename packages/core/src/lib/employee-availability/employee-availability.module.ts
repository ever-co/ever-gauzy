import { Module } from '@nestjs/common';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { EmployeeAvailabilityController } from './employee-availability.controller';

@Module({
	providers: [EmployeeAvailabilityService],
	controllers: [EmployeeAvailabilityController]
})
export class EmployeeAvailabilityModule {}
