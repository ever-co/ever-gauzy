import { Module } from '@nestjs/common';
import { EmployeeLevelController } from './organization-employee-level.controller';
import { EmployeeLevelService } from './organization-employee-level.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeLevel } from './organization-employee-level.entity';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeLevel]), CqrsModule],
	controllers: [EmployeeLevelController],
	providers: [EmployeeLevelService]
})
export class EmployeeLevelModule {}
