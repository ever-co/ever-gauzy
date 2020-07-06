import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef
} from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { TimeTrackerService } from './time-tracker.service';

@Component({
	selector: 'ngx-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss'],
	changeDetection: ChangeDetectionStrategy.Default
})
export class TimeTrackerComponent implements OnInit {
	start: Boolean = false;
	timeRun: any = {
		second: '00',
		minute: '00',
		hours: '00'
	};
	TimeDay: {
		second: 0;
		minute: 0;
		hours: 0;
	};

	userData: any;
	projects: any;
	tasks: any = [];
	organization: any = {};
	projectSelect = '';
	taskSelect = '';

	auth: any = {};
	constructor(
		private electronService: ElectronService,
		private _cdr: ChangeDetectorRef,
		private timeTrackerService: TimeTrackerService
	) {
		this.electronService.ipcRenderer.on('timer_push', (event, arg) => {
			this.setTime(arg);
		});

		this.electronService.ipcRenderer.on(
			'timer_tracker_show',
			(event, arg) => {
				this.auth = arg;
				this.getTask(arg);
			}
		);
	}

	ngOnInit(): void {
		// this.getTask()
	}

	toggleStart() {
		this.start = !this.start;
		if (this.start) {
			console.log('start');
			this.startTime();
		} else {
			this.stopTimer();
		}
	}

	setTime(value) {
		value.second = value.second % 60;
		value.minute = value.minute % 60;
		this.timeRun = {
			second:
				value.second.toString().length > 1
					? `${value.second}`
					: `0${value.second}`,
			minute:
				value.minute.toString().length > 1
					? `${value.minute}`
					: `0${value.minute}`,
			hours:
				value.hours.toString().length > 1
					? `${value.hours}`
					: `0${value.hours}`
		};
		this._cdr.detectChanges();
	}

	startTime() {
		this.electronService.ipcRenderer.send('start_timer', {
			projectId: this.projectSelect,
			taskId: this.taskSelect
		});
	}

	stopTimer() {
		this.electronService.ipcRenderer.send('stop_timer');
		this.timeRun = {
			second: '00',
			minute: '00',
			hours: '00'
		};
	}

	getTask(arg) {
		this.timeTrackerService.getTasks(arg).then((res: any) => {
			console.log('task list', res);
			this.organization = res.items;
			this.getProjects(this.organization);
		});
	}

	getProjects(items) {
		this.projects = items.map((item) => item.project);
	}

	setProject(item) {
		console.log(item);
		this.projectSelect = item;
		this.tasks = this.organization.filter((t) => t.project.id === item);
	}

	setTask(item) {
		this.taskSelect = item;
	}
}
