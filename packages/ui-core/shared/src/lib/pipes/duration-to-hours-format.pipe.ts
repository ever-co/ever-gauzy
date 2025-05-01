import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
	name: 'hoursDuration',
	standalone: false
})
export class HoursDurationFormatPipe implements PipeTransform {
	/**
	 * Transforms the given number of seconds into hours.
	 *
	 * @param {number} seconds - The number of seconds to transform.
	 */
	transform(seconds: number): number {
		const duration = seconds < 0 ? 0 : seconds;
		const totalHours: number = duration / 3600;
		const roundedTotalHours = Math.round((totalHours + Number.EPSILON) * 1000) / 1000;
		return roundedTotalHours;
	}
}
