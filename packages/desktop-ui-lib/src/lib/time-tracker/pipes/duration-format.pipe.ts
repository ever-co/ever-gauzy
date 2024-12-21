import { Pipe, PipeTransform } from '@angular/core';
import * as moment from 'moment';
import 'moment-duration-format';

@Pipe({
    name: 'durationFormat',
    standalone: false
})
export class DurationFormatPipe implements PipeTransform {
	transform(
		value: number,
		format?: string,
		settings?: moment.DurationFormatSettings,
		unitOfTime?: moment.unitOfTime.DurationConstructor
	): string {
		return moment.duration(value, unitOfTime || 'seconds').format(
			format || 'HH:mm:ss',
			settings || {
				trim: false,
				trunc: true
			}
		);
	}
}
