import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from './time-off-request.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffRequestControler } from './time-off-request.controller';

@Module({
	imports: [TypeOrmModule.forFeature([TimeOffRequest, Employee])],
	controllers: [TimeOffRequestControler],
	providers: [TimeOffRequestService],
	exports: [TypeOrmModule]
})
export class TimeOffRequestModule {}
