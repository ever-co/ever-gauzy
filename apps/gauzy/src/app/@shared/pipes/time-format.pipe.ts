import { Pipe, PipeTransform, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { IOrganization } from '@gauzy/contracts';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Pipe({
	name: 'timeFormat',
	pure: false
})
export class TimeFormatPipe implements PipeTransform, OnDestroy {
	private format: 12 | 24;

	constructor(private store: Store) {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org: IOrganization) => {
				this.format = org ? org.timeFormat : 12;
			});
	}

	transform(value: any, seconds: boolean = false): any {
		let format = 'HH:mm' + (seconds ? ':ss' : '');
		if (this.format === 12) {
			format = 'hh:mm' + (seconds ? ':ss' : '') + ' A';
		}
		let date = moment(value);
		if (!date.isValid()) {
			date = moment.utc(value, 'HH:mm');
		}
		return date.format(format);
	}

	ngOnDestroy() {}
}
