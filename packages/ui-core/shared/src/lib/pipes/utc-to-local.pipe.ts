import { Pipe, PipeTransform } from '@angular/core';
import * as moment from 'moment';
import { toLocal } from '@gauzy/ui-core/common';

@Pipe({
	name: 'utcToLocal'
})
export class UtcToLocalPipe implements PipeTransform {
	/**
	 * Transforms the given date/time value to the local timezone and returns it as a JavaScript Date object.
	 * @param value The date/time value to be transformed. Can be a string, Date, or moment object.
	 * @param format The format to be used when parsing the date if initial parsing fails. Default is 'HH:mm'.
	 * @returns A JavaScript Date object representing the date/time in the local timezone.
	 */
	transform(value: any, format: string = 'HH:mm'): any {
		let date = moment(value);
		if (!date.isValid()) date = moment.utc(value, format);

		return toLocal(date).toDate();
	}
}
