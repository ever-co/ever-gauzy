import { Component } from '@angular/core';
import * as moment from 'moment';

@Component({
	template: `
		{{ transformSeconds() }}
	`
})
export class TaskEstimateComponent {
	value: any;

	transformSeconds() {
		const duration = moment.duration(this.value, 'seconds');

		const days = duration.days();

		const hours =
			duration.hours() >= 10 ? duration.hours() : '0' + duration.hours();

		const minutes =
			duration.minutes() >= 10
				? duration.minutes()
				: '0' + duration.minutes();

		return `${days}d ${hours}h ${minutes}m`;
	}
}
