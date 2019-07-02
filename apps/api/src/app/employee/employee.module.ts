import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
    imports: [
        TypeOrmModule.forFeature([Employee]),
        CqrsModule
    ],
    controllers: [EmployeeController],
    providers: [EmployeeService, ...CommandHandlers],
    exports: [EmployeeService],
})
export class EmployeeModule { }
