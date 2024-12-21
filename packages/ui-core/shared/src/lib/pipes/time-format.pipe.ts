import { Pipe, PipeTransform, OnDestroy } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, TimeFormatEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Pipe({
    name: 'timeFormat',
    pure: false,
    standalone: false
})
export class TimeFormatPipe implements PipeTransform, OnDestroy {
	private format: TimeFormatEnum;

	constructor(private readonly store: Store) {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.format = organization?.timeFormat ?? TimeFormatEnum.FORMAT_12_HOURS;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Transforms a given value into a formatted time string.
	 * @param value The value to transform into a time string. This can be a string, number, Date object, or any value parsable by moment.js.
	 * @param timeFormat The time format to use. If not provided, it defaults to `this.format`.
	 * @param seconds Optional. If true, include seconds in the formatted time string. Defaults to false.
	 * @returns A formatted time string based on the input value and format options.
	 */
	transform(value: any, timeFormat: number = this.format, seconds: boolean = true): any {
		let format = 'HH:mm' + (seconds ? ':ss' : '');

		if (timeFormat === TimeFormatEnum.FORMAT_12_HOURS) {
			format = 'hh:mm' + (seconds ? ':ss' : '') + ' A';
		}

		let date = moment(value);
		if (!date.isValid()) date = moment.utc(value, 'HH:mm');

		return date.format(format);
	}

	ngOnDestroy() {}
}
