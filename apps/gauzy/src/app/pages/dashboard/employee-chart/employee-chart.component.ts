import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.serivce';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { monthNames } from '../../../@core/utils/date';

@Component({
    selector: 'ngx-employee-chart',
    template: `
        <chart style="height: 620px" type="horizontalBar" [data]="data" [options]="options"></chart>
    `,
    styleUrls: ['./employee-chart.component.scss']
})
export class EmployeeChartComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();
    data: any;
    options: any;
    statistics;
    incomeStatistics: number[];
    expenseStatistics: number[];
    profitStatistics: number[] = [];
    bonusStatistics: number[] = [];

    constructor(private themeService: NbThemeService,
                private employeeStatisticsService: EmployeeStatisticsService,
                private store: Store) { }

    async ngOnInit() {
        this._getLast12months();

        this.store.selectedEmployee$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async emp => {
                if (emp.id) {
                    try {
                        this.statistics = await this.employeeStatisticsService
                            .getStatisticsByEmployeeId(emp.id);

                        this.incomeStatistics = this.statistics.sortedEmployeeIncome.map(o => Object.values(o)[0]);
                        this.expenseStatistics = this.statistics.sortedEmployeeExpenses.map(o => Object.values(o)[0]);
                        this.expenseStatistics.forEach((expenseStat, index) => {
                            const profit = this.incomeStatistics[index] - expenseStat;
                            this.profitStatistics.push(profit);
                            this.bonusStatistics.push((profit * 75) / 100);
                        });

                        const avarageBonus = this.bonusStatistics.reduce((a, b) => a + b, 0) / this.bonusStatistics.length;
                        this.employeeStatisticsService.avarageBonus$.next(Math.floor(avarageBonus));

                        this.themeService.getJsTheme()
                            .pipe(takeUntil(this._ngDestroy$))
                            .subscribe(config => {
                                const colors: any = config.variables;
                                console.log(colors)
                                const chartjs: any = config.variables.chartjs;

                                this.data = {
                                    labels: this._getLast12months(),
                                    datasets: [
                                        {
                                            label: 'Revenue',
                                            backgroundColor: colors.infoLight,
                                            borderWidth: 1,
                                            data: this.incomeStatistics
                                        },
                                        {
                                            label: 'Expenses',
                                            backgroundColor: colors.successLight,
                                            data: this.expenseStatistics,
                                        },
                                        {
                                            label: 'Profit',
                                            backgroundColor: colors.warningLight,
                                            data: this.profitStatistics,
                                        },
                                        {
                                            label: 'Bonus',
                                            backgroundColor: '#CA521A',
                                            data: this.bonusStatistics,
                                        },
                                    ],
                                };

                                this.options = {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    elements: {
                                        rectangle: {
                                            borderWidth: 2,
                                        },
                                    },
                                    scales: {
                                        xAxes: [
                                            {
                                                gridLines: {
                                                    display: true,
                                                    color: chartjs.axisLineColor,
                                                },
                                                ticks: {
                                                    fontColor: chartjs.textColor,
                                                },
                                            },
                                        ],
                                        yAxes: [
                                            {
                                                gridLines: {
                                                    display: false,
                                                    color: chartjs.axisLineColor,
                                                },
                                                ticks: {
                                                    fontColor: chartjs.textColor,
                                                },
                                            },
                                        ],
                                    },
                                    legend: {
                                        position: 'right',
                                        labels: {
                                            fontColor: chartjs.textColor,
                                        },
                                    },
                                };
                            });
                    } catch (error) {
                        console.error(error)
                    }
                }
            });
    }

    private _getLast12months() {
        const start = (new Date(Date.now())).getMonth() + 1;
        const end = start + 11;
        const currentYear = (new Date(Date.now())).getFullYear() - 2000;

        const monthsNeeded = [];

        for (let i = start; i <= end; i++) {
            if (i > 11) {
                monthsNeeded.push(monthNames[i - 12] + ` '${currentYear}`);
            } else {
                monthsNeeded.push(monthNames[i] + ` '${currentYear - 1}`);
            }
        }

        return monthsNeeded.reverse();
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
