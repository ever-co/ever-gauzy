import { Pipe, PipeTransform } from '@angular/core';
import dayjs from 'dayjs';

@Pipe({
    name: 'dayjs',
    standalone: false
})
export class DayjsPipe implements PipeTransform {
	transform(value: Date): dayjs.Dayjs {
		return dayjs(value);
	}
}
