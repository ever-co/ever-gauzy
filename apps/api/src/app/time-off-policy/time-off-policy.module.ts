import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffPolicyService } from './time-off-policy.service';
import { TimeOffPolicy } from './time-off-policy.entity';
import { Employee } from '../employee';
import { TimeOffPolicyControler } from './time-off-policy.controller';

@Module({
	imports: [TypeOrmModule.forFeature([TimeOffPolicy, Employee])],
	controllers: [TimeOffPolicyControler],
	providers: [TimeOffPolicyService],
	exports: [TypeOrmModule]
})
export class TimeOffPolicyModule {}
