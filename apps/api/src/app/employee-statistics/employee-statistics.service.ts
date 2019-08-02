import { Injectable } from '@nestjs/common';
import { EmployeeSettingsFindInput } from '@gauzy/models';
import { IncomeService } from '../income';
import { ExpenseService } from '../expense';

@Injectable()
export class EmployeeStatisticsService {
    private _monthLiterals = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];

    constructor(private incomeService: IncomeService,
        private expenseService: ExpenseService) { }

    async getStatisticsByEmployeeId(employeeId: string, findInput?: EmployeeSettingsFindInput) {
        const allEmployeeIncome = await this.incomeService.findAll({
            where: {
                employee: {
                    id: employeeId
                }
            }
        });

        const mappedEmployeeIncome = allEmployeeIncome.items.map(e => {
            const obj = {};
            const formattedDate = this._formatDate(e.valueDate);;

            obj[formattedDate] = e.amount;

            return obj;
        });

        const allEmployeeExpense = await this.expenseService.findAll({
            where: {
                employee: {
                    id: employeeId
                }
            }
        });

        const mappedEmployeeExpenses = allEmployeeExpense.items.map(e => {
            const obj = {};
            const formattedDate = this._formatDate(e.valueDate);

            obj[formattedDate] = e.amount;

            return obj;
        });

        const sortedEmployeeExpenses = [];

        mappedEmployeeExpenses.forEach(obj => {
            for (const key in obj) {
                if (sortedEmployeeExpenses[key]) {
                    sortedEmployeeExpenses[key] += obj[key];
                } else {
                    sortedEmployeeExpenses[key] = obj[key];
                }
            }
        });

        const sortedEmployeeIncome = [];

        mappedEmployeeIncome.forEach(obj => {
            for (const key in obj) {
                if (sortedEmployeeIncome[key]) {
                    sortedEmployeeIncome[key] += obj[key];
                } else {
                    sortedEmployeeIncome[key] = obj[key];
                }
            }
        });
        
        return {
            sortedEmployeeExpenses,
            sortedEmployeeIncome
        }
    }

    private _formatDate(valueDate: Date) {
        return `${this._monthLiterals[valueDate.getMonth()]} '${valueDate.getFullYear() - 2000}`;
    }
}
