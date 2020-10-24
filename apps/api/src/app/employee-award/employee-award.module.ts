import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeAward } from './employee-award.entity';
import { EmployeeAwardController } from './employee-award.controller';
import { EmployeeAwardService } from './employee-award.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeAward]), TenantModule],
	controllers: [EmployeeAwardController],
	providers: [EmployeeAwardService]
})
export class EmployeeAwardModule {}
