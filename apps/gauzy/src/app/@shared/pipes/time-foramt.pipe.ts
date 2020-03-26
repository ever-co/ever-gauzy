import { Pipe, PipeTransform } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs/internal/Subject';
import { Organization } from '@gauzy/models';
import * as moment from 'moment';

@Pipe({
	name: 'timeForamt',
	pure: false
})
export class TimeForamtPipe implements PipeTransform {
	private _ngDestroy$ = new Subject<void>();
	private format: 12 | 24;

	constructor(private store: Store) {
		this.store.selectedOrganization$.subscribe((org: Organization) => {
			this.format = org.timeFormat || 12;
		});
	}

	transform(value: any, seconds: boolean = false): any {
		let format = 'HH:mm' + (seconds ? 'ss' : '');
		if (this.format == 12) {
			format = 'hh:mm' + (seconds ? 'ss' : '') + ' A';
		}
		return moment.utc(value, 'HH:mm').format(format);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
