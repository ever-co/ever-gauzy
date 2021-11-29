import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	ChangeDetectorRef,
	ChangeDetectionStrategy
} from '@angular/core';
import { ElectronServices } from '../electron/services';

@Component({
	selector: 'ngx-server-dashboard',
	templateUrl: './server-dashboard.component.html',
	styleUrls: ['./server-dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServerDashboardComponent implements OnInit {
	@ViewChild('logbox') logbox: ElementRef;
	@ViewChild('logServer') logAccordion;
	active_index: any;
    gauzyIcon = './assets/images/logos/logo_Gauzy.svg';
	running=false;
	loading = false;
	btn:any = {
		name: 'Start',
		icon: 'play-circle-outline'
	}
	logContents:any = [];
	isExpandWindow = false;
	logIsOpen:boolean = false;
	styles = {
		btnStart: 'button-small',
		icon: 'margin-icon-small'
	}

    constructor(
		private electronService: ElectronServices,
		private _cdr: ChangeDetectorRef
	) {
		this.electronService.ipcRenderer.on(
			'running_state',
			(event, arg) => {
				this.loading = false;
				this.btn = {
					name: arg ? 'Stop' : 'Start',
					icon: arg ? 'stop-circle-outline' : 'play-circle-outline'
				};
				this.running = arg
				event.sender.send('running_state', arg);
				this._cdr.detectChanges();
			}
		);

		this.electronService.ipcRenderer.on(
			'log_state',
			(event, arg) => {
				if (this.logContents.length < 20) {
					this.logContents.push(arg.msg);
				} else {
					this.logContents.shift();
					this.logContents.push(arg.msg);
				}
				this._cdr.detectChanges();
				this.scrollToBottom();
				console.log(arg);
			}
		)

		this.electronService.ipcRenderer.on('resp_msg', (event, arg) => {
			event.sender.send('resp_msg_server', arg);
		})

		this.electronService.ipcRenderer.on('loading_state', (event, arg) => {
			this.loading = arg;
			event.sender.send('loading_state');
			this.electronService.ipcRenderer.send('expand_window');
			this.isExpandWindow = true;
			this.styles.btnStart = 'button-big';
			this.styles.icon = 'margin-icon';
			this.logIsOpen = true;
			this._cdr.detectChanges();
		})
	}

	
	ngOnInit(): void {
		this.active_index = 0;
	}

	private scrollToBottom() {
        this.logbox.nativeElement.scrollTop = this.logbox.nativeElement.scrollHeight;
    }

    runServer() {
		this.logContents = [];
		this.loading = true;
		this.btn = {
			name: '',
			icon: ''
		};
		this.logIsOpen = true;
        this.electronService.ipcRenderer.send('run_gauzy_server');
		this.electronService.ipcRenderer.send('expand_window');
		this.isExpandWindow = true;
		this.styles.btnStart = 'button-big';
		this.styles.icon = 'margin-icon'
		this._cdr.detectChanges();
    }

	stopServer() {
		this.loading = true;
		this.btn = {
			name: '',
			icon: ''
		};
		this.logIsOpen = true;
		this.electronService.ipcRenderer.send('stop_gauzy_server');
		this._cdr.detectChanges();
	}

	logBoxChange(e) {
		if (e) {
			this.logIsOpen = false;
		} else {
			this.logIsOpen = true;
		}
	}
}
