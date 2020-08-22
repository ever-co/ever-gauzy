import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
	name: 'durationFormat'
})
export class DurationFormatPipe implements PipeTransform {
	transform(seconds: number): any {
		let duration = seconds;
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

		//return moment.utc(seconds * 1000).format('HH:mm:ss');
	}
}
