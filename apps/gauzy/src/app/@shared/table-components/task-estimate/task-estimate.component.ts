import { Component } from '@angular/core';
import * as moment from 'moment';

@Component({
	selector: 'ngx-task-estimate',
	template: `
		<div>
			{{ transformSeconds() }}
		</div>
	`,
	styles: [``]
})
export class TaskEstimateComponent {
	value: any;

	transformSeconds() {
		const duration = moment.duration(this.value, 'seconds');

		return `${duration.days()}d ${
			duration.hours() >= 10 ? duration.hours() : '0' + duration.hours()
		}h ${
			duration.minutes() >= 10
				? duration.minutes()
				: '0' + duration.minutes()
		}m`;
	}
}
