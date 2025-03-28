import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
	name: 'hoursDuration'
})
export class HoursDurationFormatPipe implements PipeTransform {
	/**
	 * Transforms the given number of seconds into a formatted duration string in the format Hh.
	 *
	 * @param {number} seconds - The number of seconds to transform.
	 * @return {string} The formatted duration string in the format Hh.
	 */
	transform(seconds: number): number {
		const duration = seconds < 0 ? 0 : seconds;
		const hours: number = Math.floor(duration / 3600);
		const remainingSeconds: number = duration % 3600;
		const minutes: number = Math.floor(remainingSeconds / 60);
		const remainingSecs: number = remainingSeconds % 60;
		const totalHours: number = hours + minutes / 60 + remainingSecs / 3600;
		const roundedTotalHours = Math.round((totalHours + Number.EPSILON) * 1000) / 1000;
		return roundedTotalHours;
	}
}
