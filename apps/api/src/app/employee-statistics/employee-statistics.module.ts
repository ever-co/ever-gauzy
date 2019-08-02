import { Module } from '@nestjs/common';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import { IncomeService, Income } from '../income';
import { ExpenseService, Expense } from '../expense';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [
        TypeOrmModule.forFeature([Income, Expense]),
    ],
    controllers: [EmployeeStatisticsController],
    providers: [EmployeeStatisticsService, IncomeService, ExpenseService],
    exports: [EmployeeStatisticsService],
})
export class EmployeeStatisticsModule {

}
