import { Component, Input } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { DateFormatPipe } from '../../pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-title',
	template: `{{ title }}`
})
export class DateRangeTitleComponent {

	/*
	* Getter & Setter for start element
	*/
	_start: Date;
	get start(): Date {
		return this._start;
	}
	@Input() set start(start: Date) {
		this._start = start;
	}

	/*
	* Getter & Setter for end element
	*/
	_end: Date;
	get end(): Date {
		return this._end;
	}
	@Input() set end(end: Date) {
		this._end = end;
	}

	constructor(
		private readonly dateFormatPipe: DateFormatPipe
	) {}

	/**
	 * GET date range title
	 */
	get title() {
		const start = this.dateFormatPipe.transform(this.start);
		const end = this.dateFormatPipe.transform(this.end);
		return [ start, end ].filter(Boolean).join(' - ');
	}
}
