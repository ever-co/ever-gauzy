import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Point } from './point/point.class';
import { progressStatus } from '@gauzy/common-angular';
import { BehaviorSubject, Observable } from 'rxjs';

@Component({
	selector: 'gauzy-counter-point',
	templateUrl: './counter-point.component.html',
	styleUrls: ['./counter-point.component.scss']
})
export class CounterPointComponent implements OnChanges {
	progressStatus = progressStatus;
	@Input() total: any;
	@Input() value: number;
	@Input() color: string;
	@Input() progress: boolean = false;
	points: Point[] = [];
	DEFAULT_COLOR = '#D8E3ED66';
	constructor() {}

	ngOnChanges(changes: SimpleChanges): void {
		if(!this.progress) this.generateColorizedPoints();
	}

	generateColorizedPoints() {
		const points: Point[] = [];
    let total = this.total === 0 ? 86400: this.total;
    let value = this.value;
		if (total > 24) {
			value = value / total * 24;
			total = 24;
		}
		for (let i = 0; i < total; i++) {
			if (i < value) {
				points.push(new Point(this.color));
			} else {
				points.push(new Point(this.DEFAULT_COLOR));
			}
		}
		this.points = points;
	}
}
