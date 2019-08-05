import { Injectable } from '@nestjs/common';
import { EmployeeSettingsFindInput } from '@gauzy/models';
import { IncomeService } from '../income';
import { ExpenseService } from '../expense';

@Injectable()
export class EmployeeStatisticsService {
    private _monthNames = [
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
        const mappedEmployeeIncome = (await this.incomeService.findAll({
            where: {
                employee: {
                    id: employeeId
                }
            }
        })).items.map(e => {
            const obj = {};
            const formattedDate = this._formatDate(e.valueDate);

            obj[formattedDate] = e.amount;

            return obj;
        });

        const mappedEmployeeExpenses = (await this.expenseService.findAll({
            where: {
                employee: {
                    id: employeeId
                }
            }
        })).items.map(e => {
            const obj = {};
            const formattedDate = this._formatDate(e.valueDate);

            obj[formattedDate] = e.amount;

            return obj;
        });

        const sortedEmployeeExpenses: Object[] = [];

        mappedEmployeeExpenses.forEach(obj => {
            // tslint:disable-next-line: forin
            for (const key in obj) {
                const foundObject = sortedEmployeeExpenses.find(o => o.hasOwnProperty(key));
                if (foundObject) {
                    foundObject[key] += obj[key];
                } else {
                    sortedEmployeeExpenses.push(obj);
                }
            }
        });

        const sortedEmployeeIncome: Object[] = [];

        mappedEmployeeIncome.forEach(obj => {
            // tslint:disable-next-line: forin
            for (const key in obj) {
                const foundObject = sortedEmployeeIncome.find(o => o.hasOwnProperty(key));
                if (foundObject) {
                    foundObject[key] += obj[key];
                } else {
                    sortedEmployeeIncome.push(obj);
                }
            }
        });

        const sortedProfitStatistics: Object[] = [];



        // this.expenseStatistics.forEach((expenseStat, index) => {
        //     const profit = this.incomeStatistics[index] - expenseStat;
        //     this.profitStatistics.push(profit);
        //     this.bonusStatistics.push((profit * 75) / 100);
        // });

        return {
            sortedEmployeeExpenses,
            sortedEmployeeIncome
        }
    }

    private _formatDate(valueDate: Date) {
        return `${this._monthNames[valueDate.getMonth()]} '${valueDate.getFullYear() - 2000}`;
    }
}
