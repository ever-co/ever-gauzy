import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from './time-off-request.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffRequestControler } from './time-off-request.controller';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';

@Module({
	imports: [TypeOrmModule.forFeature([TimeOffRequest, Employee, User, TimeOffPolicy])],
	controllers: [TimeOffRequestControler],
	providers: [TimeOffRequestService, UserService],
	exports: [TypeOrmModule]
})
export class TimeOffRequestModule {}
