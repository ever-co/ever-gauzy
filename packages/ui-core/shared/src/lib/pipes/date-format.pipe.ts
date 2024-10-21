import { Pipe, PipeTransform } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { IOrganization, RegionsEnum } from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Pipe({
	name: 'dateFormat',
	pure: false
})
export class DateFormatPipe implements PipeTransform {
	dateFormat: string = 'd MMMM, y';
	regionCode: string = RegionsEnum.EN;
	locale!: string;

	constructor(private readonly store: Store) {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.regionCode = organization.regionCode || RegionsEnum.EN;
					this.dateFormat = organization.dateFormat || 'd MMMM, y';
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.preferredLanguage$
			.pipe(
				distinctUntilChange(),
				filter((preferredLanguage: string) => !!preferredLanguage),
				tap((preferredLanguage: string) => {
					this.locale = preferredLanguage;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Transforms a given value into a formatted date string based on provided format and locale.
	 *
	 * @param {Date | string | number | null | undefined} value - The value to transform. Can be a Date object, string, number, or null/undefined.
	 * @param {string} [locale] - The locale to use for formatting. If not provided, the default region code will be used.
	 * @param {string} [defaultFormat] - The format to apply to the date. If not provided, the default date format will be used.
	 * @return {string | undefined} The formatted date string, or undefined if the value is falsy.
	 */
	transform(
		value: Date | string | number | null | undefined,
		locale?: string,
		defaultFormat?: string
	): string | undefined {
		if (!value) {
			return;
		}

		let date = moment(new Date(value));
		if (!date.isValid()) {
			date = moment.utc(value);
		}

		if (isEmpty(locale)) {
			locale = this.locale;
		}

		if (date && defaultFormat) {
			/**
			 * Override default format to organization date format as a priority format
			 */
			return date.locale(locale).format(defaultFormat);
		} else if (date && this.dateFormat) {
			return date.locale(locale).format(this.dateFormat);
		}

		return;
	}
}
