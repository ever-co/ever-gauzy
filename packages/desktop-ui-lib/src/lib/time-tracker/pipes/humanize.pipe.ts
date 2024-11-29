// Copyright (c) 2019-2023 Ever Co. LTD

// Modified code from https://github.com/urish/ngx-moment.
// Originally MIT Licensed
// - see https://github.com/urish/ngx-moment/blob/master/LICENSE
// - original code `ngx-moment (c) 2015, 2016 Uri Shaked`;

import { Pipe, ChangeDetectorRef, PipeTransform, OnDestroy, NgZone } from '@angular/core';
import moment from 'moment';;

@Pipe({ name: 'humanize', pure: false })
export class HumanizePipe implements PipeTransform, OnDestroy {
	private _currentTimer: number | null;
	private _lastTime: Number;
	private _lastValue: moment.MomentInput;
	private _lastOmitSuffix: boolean;
	private _lastLocale?: string;
	private _lastText: string;
	private _formatFn: (m: moment.Moment) => string;

	constructor(private cdRef: ChangeDetectorRef, private ngZone: NgZone) { }

	public format(m: moment.Moment) {
		return m.from(moment(), this._lastOmitSuffix);
	}

	public transform(
		value: moment.MomentInput,
		omitSuffix?: boolean,
		formatFn?: (m: moment.Moment) => string,
	): string {
		if (this._hasChanged(value, omitSuffix)) {
			this._lastTime = this._time(value);
			this._lastValue = value;
			this._lastOmitSuffix = omitSuffix;
			this._lastLocale = this._locale(value);
			this._formatFn = formatFn || this.format.bind(this);
			this._removeTimer();
			this._createTimer();
			this._lastText = this._formatFn(moment(value));
		} else {
			this._createTimer();
		}

		return this._lastText;
	}

	ngOnDestroy(): void {
		this._removeTimer();
	}

	private _createTimer() {
		if (this._currentTimer) {
			return;
		}

		const momentInstance = moment(this._lastValue);
		const timeToUpdate = this._secondsUntilUpdate(momentInstance) * 1000;

		this._currentTimer = this.ngZone.runOutsideAngular(() => {
			if (typeof window !== 'undefined') {
				return window.setTimeout(() => {
					this._lastText = this._formatFn(moment(this._lastValue));

					this._currentTimer = null;
					this.ngZone.run(() => this.cdRef.markForCheck());
				}, timeToUpdate);
			} else {
				return null;
			}
		});
	}

	private _removeTimer() {
		if (this._currentTimer) {
			window.clearTimeout(this._currentTimer);
			this._currentTimer = null;
		}
	}

	private _secondsUntilUpdate(momentInstance: moment.Moment) {
		const howOld = Math.abs(moment().diff(momentInstance, 'minute'));
		if (howOld < 1) {
			return 1;
		} else if (howOld < 60) {
			return 30;
		} else if (howOld < 180) {
			return 300;
		} else {
			return 3600;
		}
	}

	private _hasChanged(value: moment.MomentInput, omitSuffix?: boolean): boolean {
		return (
			this._time(value) !== this._lastTime ||
			this._locale(value) !== this._lastLocale ||
			omitSuffix !== this._lastOmitSuffix
		);
	}

	private _time(value: moment.MomentInput): number {
		if (moment.isDate(value)) {
			return value.getTime();
		} else if (moment.isMoment(value)) {
			return value.valueOf();
		} else {
			return moment(value).valueOf();
		}
	}

	private _locale(value: moment.MomentInput): string | null {
		return moment.isMoment(value) ? value.locale() : moment.locale();
	}
}
