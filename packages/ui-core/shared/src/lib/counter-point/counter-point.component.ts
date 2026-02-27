import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { NbProgressBarModule } from '@nebular/theme';
import { progressStatus } from '@gauzy/ui-core/common';
import { Point } from './point/point.class';

@Component({
	selector: 'gauzy-counter-point',
	templateUrl: './counter-point.component.html',
	styleUrls: ['./counter-point.component.scss'],
	standalone: true,
	imports: [NbProgressBarModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CounterPointComponent implements OnChanges {
	progressStatus = progressStatus;
	points: Point[] = [];

	@Input() total: number;
	@Input() value: number;
	@Input() color: string;
	@Input() progress: boolean = false;

	ngOnChanges(changes: SimpleChanges): void {
		if (!this.progress) this.generateColorizedPoints();
	}

	generateColorizedPoints(): void {
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
