import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { NbThemeService, NbToastrService } from '@nebular/theme';
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
    incomeStatistics: number[];
    expenseStatistics: number[];
    profitStatistics: number[];
    bonusStatistics: number[];

    constructor(private themeService: NbThemeService,
        private employeeStatisticsService: EmployeeStatisticsService,
        private store: Store,
        private toastrService: NbToastrService) { }

    async ngOnInit() {
        this.store.selectedEmployee$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async emp => {
                if (emp.id) {
                    try {
                        const statistics = await this.employeeStatisticsService
                            .getStatisticsByEmployeeId(emp.id);

                        this.incomeStatistics = statistics.incomeStatistics;
                        this.expenseStatistics = statistics.expenseStatistics;
                        this.profitStatistics = statistics.profitStatistics;
                        this.bonusStatistics = statistics.bonusStatistics;
                        
                        const avarageBonus = this.bonusStatistics.filter(Number).reduce((a, b) => a + b, 0) / this.bonusStatistics.filter(Number).length;
                        this.employeeStatisticsService.avarageBonus$.next(Math.floor(avarageBonus));

                        this.themeService.getJsTheme()
                            .pipe(takeUntil(this._ngDestroy$))
                            .subscribe(config => {
                               // const colors: any = config.variables;
                                const chartjs: any = config.variables.chartjs;
                                const bonusColors = this.bonusStatistics.map( val => val < 0 ? 'red' : '#0091ff');
                                const profitColors = this.profitStatistics.map(val => val < 0 ? '#ff7b00' : '#66de0b')
                                this.data = {
                                    labels: this._getMonthsWithStatistics(),
                                    datasets: [
                                        {
                                            label: 'Revenue',
                                            backgroundColor: '#089c17',
                                            borderWidth: 1,
                                            data: this.incomeStatistics
                                        },
                                        {
                                            label: 'Expenses',
                                            backgroundColor: '#dbc300',
                                            data: this.expenseStatistics
                                        },
                                        {
                                            label: 'Profit',
                                            backgroundColor: profitColors,
                                            data: this.profitStatistics,
                                        },
                                        {
                                            label: 'Bonus',
                                            backgroundColor: bonusColors,
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
                        this.toastrService.danger(error.error.message || error.message, 'Error');
                    }
                }
            });
    }

    private _filterArrayZeroesToMatchWithMonths() {
        this.expenseStatistics = this.expenseStatistics.filter(Number);
        this.incomeStatistics = this.incomeStatistics.filter(Number);
        this.profitStatistics = this.profitStatistics.filter(Number);
        this.bonusStatistics = this.bonusStatistics.filter(Number);
    }

    private _getMonthsWithStatistics() {
        const monthsWithStatistics = [];

        this._getLast12months().forEach((month, index) => {
            if (this.expenseStatistics[index] !== 0 || this.incomeStatistics[index] !== 0) {
                monthsWithStatistics.push(month);
            }
        });

        this._filterArrayZeroesToMatchWithMonths();
        return monthsWithStatistics;
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
