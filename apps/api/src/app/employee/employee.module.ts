import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';

@Module({
	imports: [TypeOrmModule.forFeature([Employee]), CqrsModule],
	controllers: [EmployeeController],
	providers: [EmployeeService, ...CommandHandlers],
	exports: [EmployeeService]
})
export class EmployeeModule {}
