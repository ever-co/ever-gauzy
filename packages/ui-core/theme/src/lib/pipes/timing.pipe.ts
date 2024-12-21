import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'timing',
    standalone: false
})
export class TimingPipe implements PipeTransform {
	/**
	 * Formats a time in seconds into minutes and seconds
	 *
	 * @param time Time in seconds
	 * @return Formatted time
	 */
	transform(time: number): string {
		if (time) {
			const minutes = Math.floor(time / 60);
			const seconds = Math.floor(time % 60);
			return `${this.initZero(minutes)}${minutes}:${this.initZero(seconds)}${seconds}`;
		}

		return '00:00';
	}

	/**
	 * Initializes a number with a leading zero
	 *
	 * @param time Number to initialize
	 * @return Initialized number
	 */
	private initZero(time: number): string {
		return time < 10 ? '0' : '';
	}
}
