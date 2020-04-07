import { Pipe, PipeTransform } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs/internal/Subject';
import { Organization } from '@gauzy/models';
import * as moment from 'moment';

@Pipe({
	name: 'timeFormat',
	pure: false
})
export class TimeFormatPipe implements PipeTransform {
	private _ngDestroy$ = new Subject<void>();
	private format: 12 | 24;

	constructor(private store: Store) {
		this.store.selectedOrganization$.subscribe((org: Organization) => {
			this.format = org ? org.timeFormat : 12;
		});
	}

	transform(value: any, seconds: boolean = false): any {
		let format = 'HH:mm' + (seconds ? ':ss' : '');
		if (this.format == 12) {
			format = 'hh:mm' + (seconds ? ':ss' : '') + ' A';
		}
		let date = moment(value);
		if (!date.isValid()) {
			date = moment.utc(value, 'HH:mm');
		}
		return date.format(format);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
