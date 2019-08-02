import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Subject } from 'rxjs';
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

    constructor(private themeService: NbThemeService) { }

    ngOnInit() {
        this.themeService.getJsTheme().subscribe(config => {
            const colors: any = config.variables;
            console.log(colors)
            const chartjs: any = config.variables.chartjs;

            this.data = {
                labels: [...monthNames],
                datasets: [
                    {
                        label: 'Revenue',
                        backgroundColor: colors.infoLight,
                        borderWidth: 1,
                        data: [
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                        ],
                    },
                    {
                        label: 'Expenses',
                        backgroundColor: colors.successLight,
                        data: [
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                        ],
                    },
                    {
                        label: 'Profit',
                        backgroundColor: colors.warningLight,
                        data: [
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
                            this.random(),
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

    private random() {
        return Math.round(Math.random() * 100);
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
