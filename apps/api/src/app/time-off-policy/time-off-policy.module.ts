import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffPolicyService } from './time-off-policy.service';
import { TimeOffPolicy } from './time-off-policy.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffPolicyController } from './time-off-policy.controller';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, TimeOffPolicy, Employee]),
		TenantModule
	],
	controllers: [TimeOffPolicyController],
	providers: [TimeOffPolicyService, UserService],
	exports: [TypeOrmModule, UserService]
})
export class TimeOffPolicyModule {}
