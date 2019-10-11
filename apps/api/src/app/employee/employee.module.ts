import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { User } from '../user/user.entity';
import { AuthService } from '../auth';
import { UserService } from '../user';

@Module({
	imports: [
		TypeOrmModule.forFeature([Employee]),
		TypeOrmModule.forFeature([User]),
		CqrsModule
	],
	controllers: [EmployeeController],
	providers: [EmployeeService, ...CommandHandlers, AuthService, UserService],
	exports: [EmployeeService]
})
export class EmployeeModule {}
