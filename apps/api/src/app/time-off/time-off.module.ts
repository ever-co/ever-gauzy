import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffPolicyService } from './policy/time-off-policy.service';
import { TimeOffPolicy } from './policy/time-off-policy.entity';
import { Employee } from '../employee';
import { TimeOffPolicyControler } from './policy/time-off-policy.controller';

@Module({
	imports: [TypeOrmModule.forFeature([TimeOffPolicy, Employee])],
	controllers: [TimeOffPolicyControler],
	providers: [TimeOffPolicyService],
	exports: [TypeOrmModule]
})
export class TimeOffModule {}
