import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Income } from './income.entity';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeService } from '../employee/employee.service';
import { Employee } from '../employee';
import { Organization, OrganizationService } from '../organization';

@Module({
    imports: [
        TypeOrmModule.forFeature([Income, Employee, Organization]),
        CqrsModule
    ],
    controllers: [IncomeController],
    providers: [IncomeService, EmployeeService, OrganizationService, ...CommandHandlers],
    exports: [IncomeService],
})
export class IncomeModule { }
