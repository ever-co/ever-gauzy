import { Pipe, PipeTransform } from '@angular/core';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { IOrganization, RegionsEnum, TimeFormatEnum } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Pipe({
	name: 'dateTimeFormat',
	pure: false
})
export class DateTimeFormatPipe implements PipeTransform {
	timeFormat: number = TimeFormatEnum.FORMAT_12_HOURS;
	dateFormat = 'd MMMM, y H:mm';
	regionCode: string = RegionsEnum.EN;

	constructor(private readonly store: Store) {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				const { regionCode, dateFormat, timeFormat } = organization;
				if (regionCode) {
					this.regionCode = regionCode;
				}
				if (dateFormat) {
					this.dateFormat = dateFormat;
				}
				if (timeFormat) {
					this.timeFormat = timeFormat;
				}
			});
	}

	/**
	 * Transforms a given date value into a formatted string based on provided format and locale.
	 *
	 * @param value The date value to transform.
	 * @param format The format to apply to the date.
	 * @param locale The locale to use for formatting.
	 * @param seconds Whether to include seconds in the time format.
	 * @returns The formatted date string.
	 */
	transform(
		value: Date | string | number | null | undefined,
		format?: string,
		locale?: string,
		seconds = true
	): string | undefined {
		if (!value) {
			return;
		}

		let date = moment(value);
		if (!date.isValid()) date = moment.utc(value);

		if (isEmpty(format)) {
			const timeFormat =
				this.timeFormat === TimeFormatEnum.FORMAT_12_HOURS
					? `hh:mm${seconds ? ':ss' : ''} A`
					: `HH:mm${seconds ? ':ss' : ''}`;
			format = `${this.dateFormat} ${timeFormat}`;
		}

		if (isEmpty(locale)) locale = this.regionCode || RegionsEnum.EN;

		return date.locale(locale).format(format);
	}
}
