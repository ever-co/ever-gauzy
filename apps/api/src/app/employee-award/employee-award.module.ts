import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeAward } from './employee-award.entity';
import { EmployeeAwardController } from './employee-award.controller';
import { EmployeeAwardService } from './employee-award.service';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeAward])],
	controllers: [EmployeeAwardController],
	providers: [EmployeeAwardService]
})
export class EmployeeAwardModule {}
