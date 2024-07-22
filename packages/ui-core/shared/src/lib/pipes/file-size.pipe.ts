import { Pipe, PipeTransform } from '@angular/core';

type unit = 'bytes' | 'KB' | 'MB' | 'GB' | 'TB';
type unitPrecisionMap = {
	[u in unit]: number;
};

const defaultPrecisionMap: unitPrecisionMap = {
	bytes: 0,
	KB: 1,
	MB: 2,
	GB: 2,
	TB: 2
};

/*
 * Convert bytes into largest possible unit.
 * Takes an precision argument that can be a number or a map for each unit.
 * Usage:
 *   bytes | fileSize:precision
 * @example
 * // returns 1 KB
 * {{ 1500 | fileSize }}
 * @example
 * // returns 2.1 GB
 * {{ 2100000000 | fileSize }}
 * @example
 * // returns 1.46 KB
 * {{ 1500 | fileSize:2 }}
 */

@Pipe({
	name: 'fileSize'
})
export class FileSizePipe implements PipeTransform {
	private readonly units: unit[] = ['bytes', 'KB', 'MB', 'GB', 'TB'];
	/**
	 * Converts a number of bytes to the largest possible unit.
	 *
	 * @param {number} bytes - The number of bytes to be converted. Defaults to 0.
	 * @param {number | unitPrecisionMap} precision - The precision of the conversion. Can be a number or a map for each unit. Defaults to defaultPrecisionMap.
	 * @return {string} The converted value with the unit.
	 */
	transform(bytes: number = 0, precision: number | unitPrecisionMap = defaultPrecisionMap): string {
		if (isNaN(parseFloat(String(bytes))) || !isFinite(bytes)) return '?';

		let unitIndex = 0;

		while (bytes >= 1000) {
			bytes /= 1000;
			unitIndex++;
		}

		const unit = this.units[unitIndex];

		if (typeof precision === 'number') {
			return bytes.toFixed(precision) + ' ' + unit;
		}
		return bytes.toFixed(precision[unit]) + ' ' + unit;
	}
}
