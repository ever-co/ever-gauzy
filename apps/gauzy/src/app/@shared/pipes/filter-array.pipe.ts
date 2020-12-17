import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'filterArray',
	pure: false
})
export class FilterArrayPipe implements PipeTransform {
	transform(values: any, input: string[]): any {
		let output = [];
		if (input && input.length > 0) {
			values.forEach((value) => {
				if (input.indexOf(value.id) !== -1) output.push(value);
			});
		}
		return output;
	}
}
