import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'removeLodash',
    standalone: false
})
export class RemoveLodashPipe implements PipeTransform {
	transform(value: string, args?: any): any {
		if (value) {
			return value.split('_').join(' ');
		} else {
			return value;
		}
	}
}
