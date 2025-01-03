import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Point } from './point/point.class';
import { progressStatus } from '@gauzy/ui-core/common';
import { NbThemeService } from '@nebular/theme';

@Component({
    selector: 'gauzy-counter-point',
    templateUrl: './counter-point.component.html',
    styleUrls: ['./counter-point.component.scss'],
    standalone: false
})
export class CounterPointComponent implements OnInit, OnChanges {
	progressStatus = progressStatus;
	@Input() total: any;
	@Input() value: number;
	@Input() color: string;
	@Input() progress: boolean = false;
	points: Point[] = [];
	DEFAULT_COLOR: string = '#D8E3ED66';
	constructor(private themeService: NbThemeService) {}

	ngOnInit(): void {
		this.themeService.getJsTheme().subscribe((theme) => {
			this.DEFAULT_COLOR = theme.variables.bg3.toString();
			if (!this.progress) this.generateColorizedPoints();
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (!this.progress) this.generateColorizedPoints();
	}

	generateColorizedPoints() {
		const points: Point[] = [];
		let total = this.total === 0 ? 86400 : this.total;
		let value = this.value;
		if (total > 24) {
			value = (value / total) * 24;
			total = 24;
		}
		for (let i = 0; i < total; i++) {
			if (i < value) {
				points.push(new Point(progressStatus((value / total) * 100)));
			} else {
				points.push(new Point('basic'));
			}
		}
		this.points = points;
	}
}
