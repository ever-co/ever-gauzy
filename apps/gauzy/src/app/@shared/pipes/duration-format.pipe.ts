import { Pipe, PipeTransform } from '@angular/core';
import * as moment from 'moment';

@Pipe({
	name: 'durationFormat'
})
export class DurationFormatPipe implements PipeTransform {
	transform(seconds: number): any {
		return moment.utc(seconds * 1000).format('HH:mm:ss');
	}
}
