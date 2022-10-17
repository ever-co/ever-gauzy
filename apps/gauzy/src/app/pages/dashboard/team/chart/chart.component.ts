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
    public data: any;
    public options: any;
    @Input()
    public statistics: any;
    @Input()
    public hideLegend: boolean = false;
    @Input()
    public type: string = 'doughnut';

    constructor(
        public readonly translateService: TranslateService,
        private readonly themeService: NbThemeService) {
        super(translateService);
    }

    ngOnInit(): void {
    }

    ngOnChanges(changes: SimpleChanges): void {
        const statistics = changes['statistics'];
        if (JSON.stringify(statistics.previousValue) !==
            JSON.stringify(statistics.currentValue)) {
            this._loadChart();
        }
    }

    private _loadChart() {
        this.themeService
            .getJsTheme()
            .pipe()
            .subscribe((config) => {
                const chart: any = config.variables.chartjs;
                this.data = {
                    labels: [
                        `${this.getTranslation('DASHBOARD_PAGE.CHARTS.WORKING_NOW')}: ${this.statistics.countOnline}`,
                        `${this.getTranslation('DASHBOARD_PAGE.CHARTS.WORKING')}: ${this.statistics.countWorking - this.statistics.countOnline}`,
                        `${this.getTranslation('DASHBOARD_PAGE.CHARTS.NOT_WORKING')}: ${this.statistics.countNotWorking}`
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
                        display: !this.hideLegend,
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
