import { Pipe, PipeTransform } from '@angular/core';
import * as moment from 'moment';

@Pipe({
    name: 'dateTime',
    standalone: false
})
export class DateTimePipe implements PipeTransform {
	/**
	 * It takes a string value, and returns a string value
	 * @param {string} value - The value to be transformed.
	 * @param {string} [format] - The format to use. Check out all the options from the Moment.js docs.
	 * @returns The date in the format specified.
	 */
	transform(value: string, format?: string): string {
		return moment(value).format(format ? format : 'lll');
	}
}
