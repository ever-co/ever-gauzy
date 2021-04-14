import { Pipe, PipeTransform } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
import * as moment from 'moment';
import { Store } from '../../@core/services/store.service';
import { isEmpty } from '@gauzy/common-angular';

@UntilDestroy({ checkProperties: true })
@Pipe({
	name: 'dateTimeFormat',
	pure: false
})
export class DateTimeFormatPipe implements PipeTransform {
	timeFormat: number;
	dateFormat: string;

	constructor(private store: Store) {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				this.dateFormat = organization.dateFormat || 'd MMMM, y H:mm';
				this.timeFormat = organization.timeFormat || 12;
			});
	}

	transform(
		value: Date | string | number | null | undefined,
		format?: string,
		timezone?: string,
		locale?: string
	) {
		let date = moment(value);
		if (!date.isValid()) {
			date = moment.utc(value);
		}

		if (!isEmpty(format)) {
			this.dateFormat = format;
		}

		return date.format(this.dateFormat);
	}
}
