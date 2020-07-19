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
	errors: any = {};
	note: String = '';

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
				this.getTask(arg);
			}
		);

		this.electronService.ipcRenderer.on('start_from_tray', (event, arg) => {
			this.toggleStart();
		});

		this.electronService.ipcRenderer.on('stop_from_tray', (event, arg) => {
			this.toggleStart();
		});

		this.electronService.ipcRenderer.on(
			'set_project_task_reply',
			(event, arg) => {
				this.setProject(arg.projectId);
				this.setTask(arg.taskId);
				this.note = arg.note;
				_cdr.detectChanges();
			}
		);
	}

	ngOnInit(): void {
		// this.getTask()
		// console.log('init', this.projectSelect);
	}

	toggleStart() {
		this.start = !this.start;
		if (this.start) {
			this.startTime();
		} else {
			this.stopTimer();
			this._cdr.detectChanges();
		}
	}

	setTime(value) {
		if (!this.start) this.start = true;
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
		if (value.second % 60 === 0) {
			this.electronService.ipcRenderer.send('update_tray_time_update', {
				hours: this.timeRun.hours,
				minutes: this.timeRun.minute
			});
		}
		this._cdr.detectChanges();
	}

	startTime() {
		if (!this.projectSelect) this.errors.project = true;
		if (!this.taskSelect) this.errors.task = true;
		if (!this.errors.task && !this.errors.project) {
			this.electronService.ipcRenderer.send('start_timer', {
				projectId: this.projectSelect,
				taskId: this.taskSelect,
				note: this.note
			});

			this.electronService.ipcRenderer.send('update_tray_start');
		}
	}

	stopTimer() {
		this.electronService.ipcRenderer.send('stop_timer');
		this.electronService.ipcRenderer.send('update_tray_stop');
		this.electronService.ipcRenderer.send('update_tray_time_update', {
			hours: '00',
			minutes: '00'
		});
		this.timeRun = {
			second: '00',
			minute: '00',
			hours: '00'
		};
	}

	getTask(arg) {
		this.timeTrackerService.getTasks(arg).then((res: any) => {
			this.organization = res.items;
			this.getProjects(this.organization, arg);
			this.electronService.ipcRenderer.send('set_project_task', {
				projectId: arg.projectId,
				taskId: arg.taskId,
				note: arg.note
			});
		});
		this._cdr.detectChanges();
	}

	getProjects(items, arg) {
		this.projects = items.map((item) => item.project);
		this._cdr.detectChanges();
	}

	setProject(item) {
		console.log('set_project', item);
		this.projectSelect = item;
		this.tasks = this.organization.filter((t) => t.project.id === item);
		this._cdr.detectChanges();
	}

	setTask(item) {
		console.log('set task', item);
		this._cdr.detectChanges();
		this.taskSelect = item;
	}
}
