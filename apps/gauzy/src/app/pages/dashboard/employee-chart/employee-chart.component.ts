import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.serivce';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';

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

    constructor(private themeService: NbThemeService,
        private employeeStatisticsService: EmployeeStatisticsService,
        private store: Store) { }

    async ngOnInit() {
        this._getLast12months();

        this.store.selectedEmployee$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async emp => {
                if (emp) {
                    try {
                        const result = await this.employeeStatisticsService
                            .getStatisticsByEmployeeId(emp.id);

                        console.log(result)
                    } catch (error) {
                        console.error(error)
                    }
                }
            });




        this.themeService.getJsTheme().subscribe(config => {
            const colors: any = config.variables;
            const chartjs: any = config.variables.chartjs;

            this.data = {
                labels: this._getLast12months(),
                datasets: [
                    {
                        label: 'Revenue',
                        backgroundColor: colors.infoLight,
                        borderWidth: 1,
                        data: [
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                        ],
                    },
                    {
                        label: 'Expenses',
                        backgroundColor: colors.successLight,
                        data: [
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                        ],
                    },
                    {
                        label: 'Profit',
                        backgroundColor: colors.warningLight,
                        data: [
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                            this._random(),
                        ],
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
    }

    private _random() {
        return Math.round(Math.random() * 100);
    }

    private _getLast12months() {
        const start = (new Date(Date.now())).getMonth() + 1;
        const end = start + 11;
        const currentYear = (new Date(Date.now())).getFullYear() - 2000;

        const monthsNeeded = [];

        for (let i = start; i <= end; i++) {
            if (i > 11) {
                monthsNeeded.push(this._monthLiterals[i - 12] + ` '${currentYear}`);
            } else {
                monthsNeeded.push(this._monthLiterals[i] + ` '${currentYear - 1}`);
            }
        }

        return monthsNeeded.reverse();
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
