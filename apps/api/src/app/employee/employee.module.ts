import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { EmploymentTypesModule } from '../employment-types/employment-types.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Employee]),
		CqrsModule,
		EmploymentTypesModule
	],
	controllers: [EmployeeController],
	providers: [EmployeeService, ...CommandHandlers],
	exports: [EmployeeService]
})
export class EmployeeModule {}
