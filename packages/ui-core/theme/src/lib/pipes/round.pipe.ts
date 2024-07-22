import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'ngxRound' })
export class RoundPipe implements PipeTransform {
	/**
	 * Rounds a number to the nearest integer
	 *
	 * @param input Number to round
	 * @return Rounded number
	 */
	transform(input: number): number {
		return Math.round(input);
	}
}
