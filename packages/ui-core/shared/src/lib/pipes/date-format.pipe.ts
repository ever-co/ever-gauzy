import { Pipe, PipeTransform, inject } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import moment from 'moment';
import { IOrganization, LanguagesEnum, RegionsEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Pipe({
	name: 'dateFormat',
	pure: false,
	standalone: true
})
export class DateFormatPipe implements PipeTransform {
	private readonly store = inject(Store);

	/**
	 * Used when the organization sets no format of its own. `LL` is the locale's long date ("January 15, 2024",
	 * "15 janvier 2024"): the day of the month in the order the language writes it. The previous fallback,
	 * `d MMMM, y`, used moment's `d`, which is the day of the WEEK, so a 15th rendered as "1 January".
	 */
	private static readonly FALLBACK_FORMAT = 'LL';

	dateFormat: string = DateFormatPipe.FALLBACK_FORMAT;
	regionCode: string = RegionsEnum.EN;
	locale: string;

	constructor() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.regionCode = organization.regionCode || RegionsEnum.EN;
					this.dateFormat = organization.dateFormat || DateFormatPipe.FALLBACK_FORMAT;
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.preferredLanguage$
			.pipe(
				distinctUntilChange(),
				filter((preferredLanguage: LanguagesEnum) => !!preferredLanguage),
				tap((preferredLanguage: LanguagesEnum) => {
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
	 * @return {string | undefined} The formatted date string, or undefined if the value is falsy or invalid.
	 */
	transform(
		value: Date | string | number | null | undefined,
		locale?: string,
		defaultFormat?: string
	): string | undefined {
		// Return undefined if no value provided
		if (!value) return;

		// Parse date and check if it's valid
		let date = moment(new Date(value));
		if (!date.isValid()) {
			date = moment.utc(value);
		}

		// If still invalid, return undefined
		if (!date.isValid()) return;

		// Set locale to the given locale or fallback to instance's locale or region code
		locale = locale || this.locale || this.regionCode;

		// Determine the format to use: defaultFormat, or fallback to instance date format
		const format = defaultFormat || this.dateFormat;

		// Return formatted date based on locale and format
		return date.locale(locale).format(format);
	}
}
