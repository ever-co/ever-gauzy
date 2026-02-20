import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'truncate',
	standalone: true
})
export class TruncatePipe implements PipeTransform {
	/**
	 * Transforms a string by truncating it to a specified limit. If `completeWords` is true, the truncation will
	 * occur at the last complete word before the limit. The truncated string is appended with an `ellipsis` string.
	 *
	 * @param {string} value - The string to be transformed.
	 * @param {number} [limit=25] - The maximum length of the transformed string. Defaults to 25.
	 * @param {boolean} [completeWords=false] - Whether the truncation should occur at the last complete word before the limit. Defaults to false.
	 * @param {string} [ellipsis='...'] - The string to append to the truncated string. Defaults to '...'.
	 * @return {string} The transformed string. If the input string is falsy, an empty string is returned.
	 */
	transform(value: string, limit = 25, completeWords = false, ellipsis = '...') {
		if (!value) {
			return;
		}
		if (completeWords) {
			limit = value.substring(0, limit).lastIndexOf(' ');
		}
		return value.length > limit ? value.substring(0, limit) + ellipsis : value;
	}
}
