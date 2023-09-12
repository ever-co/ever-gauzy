import { Pipe, PipeTransform } from '@angular/core';
import * as moment from 'moment';
import 'moment-duration-format';

@Pipe({
	name: 'durationFormat',
})
export class DurationFormatPipe implements PipeTransform {
	transform(
		value: number,
		format?: string,
		unitOfTime?: moment.unitOfTime.DurationConstructor
	): string {
		return moment
			.duration(value, unitOfTime || 'seconds')
			.format(format || 'HH:mm:ss', {
				trim: false,
				trunc: true,
			});
	}
}
