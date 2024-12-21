import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { progressStatus } from '@gauzy/ui-core/common';

export interface IStatisticItem {
	imageUrl?: string;
	title: string;
	durationPercentage?: string;
	duration: number;
}

@Component({
    selector: 'ngx-statistic',
    templateUrl: './statistic.component.html',
    styleUrls: ['./statistic.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class StatisticComponent {
	private _items: IStatisticItem[] = [];

	@Input()
	public set items(values: IStatisticItem[]) {
		if (values) {
			this._items = [...values];
		} else {
			this._items = [];
		}
	}

	public get items(): IStatisticItem[] {
		return this._items;
	}

	public progressStatus(value: number): string {
		return progressStatus(value);
	}
}
