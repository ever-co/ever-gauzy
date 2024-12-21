import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
    name: 'durationFormat',
    standalone: false
})
export class DurationFormatPipe implements PipeTransform {
	/**
	 * Transforms the given number of seconds into a formatted duration string in the format HH:mm:ss.
	 *
	 * @param {number} seconds - The number of seconds to transform.
	 * @return {string} The formatted duration string in the format HH:mm:ss.
	 */
	transform(seconds: number): string {
		let duration = seconds < 0 ? 0 : seconds;
		let hours: any = parseInt(duration / 3600 + '', 10);
		duration = duration % 3600;

		let min: any = parseInt(duration / 60 + '', 10);
		duration = duration % 60;

		let sec: any = parseInt(duration + '', 10);

		if (sec < 10) {
			sec = `0${sec}`;
		}
		if (min < 10) {
			min = `0${min}`;
		}
		if (hours < 10) {
			hours = `0${hours}`;
		}
		return `${hours}:${min}:${sec}`;
	}
}
