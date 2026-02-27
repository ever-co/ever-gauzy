import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
export class CounterPointComponent {
	getProgressStatus = progressStatus;

	total = input<number>(0);
	value = input<number>(0);
	color = input<string>('');
	progress = input<boolean>(false);

	points = computed<Point[]>(() => {
		if (this.progress()) return [];

		const points: Point[] = [];
		let total = this.total() === 0 ? 86400 : this.total();
		let value = this.value();

		if (total > 24) {
			value = (value / total) * 24;
			total = 24;
		}

		for (let i = 0; i < total; i++) {
			if (i < value) {
				points.push({ color: this.color() || progressStatus((value / total) * 100) });
			} else {
				points.push({ color: 'basic' });
			}
		}

		return points;
	});
}
