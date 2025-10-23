import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'localDateParse' })
export class LocalDateParse implements PipeTransform {
	transform(dateString: string): string {
		if (!dateString) {
			return null;
		}
		const date = new Date(dateString);
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

		const fmt: Intl.DateTimeFormatOptions = {
			dateStyle: 'medium',
			timeStyle: 'medium',
		};

		return new Intl.DateTimeFormat(undefined, {
			...fmt,
			timeZone: tz,
		}).format(date);
	}
}
