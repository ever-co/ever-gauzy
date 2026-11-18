import { Pipe, PipeTransform, inject } from '@angular/core';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import moment from 'moment';
import { IOrganization, RegionsEnum, TimeFormatEnum } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Pipe({
	name: 'dateTimeFormat',
	pure: false,
	standalone: true
})
export class DateTimeFormatPipe implements PipeTransform {
	private readonly store = inject(Store);

	timeFormat: number = TimeFormatEnum.FORMAT_12_HOURS;
	/**
	 * The date part used when the organization sets no format; `transform()` appends the time itself. `LL` is the
	 * locale's long date. The previous fallback, `d MMMM, y H:mm`, used moment's `d` (day of the WEEK, so a 15th
	 * read "1 January") and carried a time of its own, which `transform()` then followed with a second one.
	 */
	dateFormat: string = 'LL';
	regionCode: string = RegionsEnum.EN;

	constructor() {
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
		seconds: boolean = true
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
