import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	AfterViewInit,
	ViewChild,
	ElementRef
} from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { TimeTrackerService } from './time-tracker.service';

@Component({
	selector: 'ngx-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss'],
	changeDetection: ChangeDetectionStrategy.Default
})
export class TimeTrackerComponent implements OnInit, AfterViewInit {
	@ViewChild('selectRef') selectProjectElement: ElementRef;
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
	aw: Boolean = false;
	loadingAw = false;
	iconAw = 'close-square-outline';
	statusIcon = 'success';
	awCheck = false;
	defaultAwAPI = 'http:localhost:5600';

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
				this.aw = arg.aw && arg.aw.isAw ? arg.aw.isAw : false;
				this.selectProjectElement.nativeElement.focus();
				const el: HTMLElement = this.selectProjectElement
					.nativeElement as HTMLElement;
				setTimeout(() => el.click(), 1000);
				_cdr.detectChanges();
			}
		);
	}

	ngOnInit(): void {
		// this.getTask()
		// console.log('init', this.projectSelect);
		console.log('on init');
		this.electronService.ipcRenderer.send('time_tracker_ready');
	}

	ngAfterViewInit(): void {
		console.log('test after view');
		this.electronService.ipcRenderer.send('time_tracker_ready');
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

		if (value.second % 5 === 0) {
			this.pingAw(null);
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
				note: this.note,
				aw: {
					host: this.defaultAwAPI,
					isAw: this.aw
				}
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
				note: arg.note,
				aw: arg.aw
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

	setAW() {
		this.aw = !this.aw;
		if (this.aw) this.pingAw(null);
		else {
			this.awCheck = false;
			this._cdr.detectChanges();
		}
	}

	pingAw(host) {
		this.loadingAw = true;
		this.awCheck = false;
		this.timeTrackerService
			.pingAw(`${host || this.defaultAwAPI}/api`)
			.then((res) => {
				this.iconAw = 'checkmark-square-outline';
				this.awCheck = true;
				this.statusIcon = 'success';
				this._cdr.detectChanges();
			})
			.catch((e) => {
				if (e.status === 200) {
					this.iconAw = 'checkmark-square-outline';
					this.awCheck = true;
					this.statusIcon = 'success';
					this._cdr.detectChanges();
					this.loadingAw = false;
				} else {
					this.loadingAw = false;
					this.iconAw = 'close-square-outline';
					this.awCheck = true;
					this.statusIcon = 'danger';
					this._cdr.detectChanges();
				}
			});
	}
}
