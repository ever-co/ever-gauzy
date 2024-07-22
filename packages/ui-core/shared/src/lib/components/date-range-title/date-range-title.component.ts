import { Component, Input } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { DateFormatPipe } from '../../pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-title',
	template: `<span>{{ title }}</span>`,
	styles: [
		`
			span {
				font-size: 14px;
				font-weight: 600;
				line-height: 16px;
				letter-spacing: -0.009em;
				color: var(--gauzy-text-color-2);
			}
		`
	]
})
export class DateRangeTitleComponent {
	/*
	 * Getter & Setter for start element
	 */
	private _start: Date;
	get start(): Date {
		return this._start;
	}
	@Input() set start(start: Date) {
		this._start = start;
	}

	/*
	 * Getter & Setter for end element
	 */
	private _end: Date;
	get end(): Date {
		return this._end;
	}
	@Input() set end(end: Date) {
		this._end = end;
	}

	/*
	 * Getter & Setter for default format
	 */
	private _format: string;
	get format(): string {
		return this._format;
	}
	@Input() set format(format: string) {
		this._format = format;
	}

	constructor(private readonly dateFormatPipe: DateFormatPipe) {}

	/**
	 * GET date range title
	 */
	get title() {
		const start = this.dateFormatPipe.transform(this.start, null, this.format);
		const end = this.dateFormatPipe.transform(this.end, null, this.format);
		return [start, end].filter(Boolean).join(' - ');
	}
}
