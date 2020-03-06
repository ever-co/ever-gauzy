import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { User, UserService } from '../user';

@Module({
	imports: [TypeOrmModule.forFeature([Employee, User]), CqrsModule],
	controllers: [EmployeeController],
	providers: [EmployeeService, UserService, ...CommandHandlers],
	exports: [EmployeeService]
})
export class EmployeeModule {}
