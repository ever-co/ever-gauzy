import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { TranslationBaseComponent } from "../../../../@shared/language-base";
import { TranslateService } from "@ngx-translate/core";
import { NbThemeService } from "@nebular/theme";

@Component({
    selector: 'gauzy-chart',
    templateUrl: './chart.component.html',
    styleUrls: ['./chart.component.scss']
})
export class ChartComponent extends TranslationBaseComponent implements OnInit, OnChanges {
    data: any;
    options: any;
    @Input()
    statistics: any;

    constructor(
        public readonly translateService: TranslateService,
        private readonly themeService: NbThemeService) {
        super(translateService);
    }

    ngOnInit(): void {

    }

    ngOnChanges(changes: SimpleChanges): void {
        this._loadChart();
    }

    private _loadChart() {
        this.themeService
            .getJsTheme()
            .pipe()
            .subscribe((config) => {
                const chart: any = config.variables.chartjs;
                this.data = {
                    labels: [
                        `Working now: ${this.statistics.countOnline}`,
                        `Working: ${this.statistics.countWorking - this.statistics.countOnline}`,
                        `Not working: ${this.statistics.countNotWorking}`
                    ],
                    datasets: [
                        {
                            data: [
                                this.statistics.countOnline,
                                this.statistics.countWorking - this.statistics.countOnline,
                                this.statistics.countNotWorking
                            ],
                            backgroundColor: [
                                'green',
                                'orange',
                                'red',
                            ],
                            hoverBorderColor: 'rgba(0, 0, 0, 0)',
                            borderWidth: 0
                        }
                    ]
                };
                this.options = {
                    responsive: true,
                    maintainAspectRatio: false,
                    elements: {
                        rectangle: {
                            borderWidth: 2
                        }
                    },
                    scales: {},
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            fontColor: chart.textColor
                        }
                    },
                    tooltips: {
                        enabled: true,
                        callbacks: {
                            label: function (tooltipItem, data) {
                                return data.labels[tooltipItem.index] || '';
                            }
                        }
                    }
                };
            });
    }
}
