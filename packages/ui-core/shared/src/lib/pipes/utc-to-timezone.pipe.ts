import { Pipe, PipeTransform } from '@angular/core';
import moment from 'moment';
import { toTimezone } from '@gauzy/ui-core/common';

@Pipe({
	name: 'utcToTimezone'
})
export class UtcToTimezone implements PipeTransform {
	/**
	 * Transforms the given date/time value to the specified timezone and returns it as a JavaScript Date object.
	 *
	 * @param value The date/time value to be transformed. Can be a string, Date, or moment object.
	 * @param timezone The IANA timezone identifier (e.g., 'America/New_York', 'Europe/London') to which the date should be converted.
	 * @param format The format to be used when parsing the date if initial parsing fails. Default is 'HH:mm'.
	 * @returns A JavaScript Date object representing the date/time in the specified timezone.
	 */
	transform(value: any, timezone: string, format: string = 'YYYY-MM-DD HH:mm:ss'): any {
		let date = moment(value);
		if (!date.isValid()) date = moment.utc(value, format);

		if (timezone) return toTimezone(date, timezone).format(format);
	}
}
