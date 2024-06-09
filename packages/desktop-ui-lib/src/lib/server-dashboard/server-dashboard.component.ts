import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	Inject,
	NgZone,
	OnInit,
	ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LanguagesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { from, tap } from 'rxjs';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';
import { LanguageSelectorService } from '../language/language-selector.service';

export enum ServerStatus {
	START = 'BUTTONS.START',
	STOP = 'BUTTONS.STOP'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-server-dashboard',
	templateUrl: './server-dashboard.component.html',
	styleUrls: ['./server-dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerDashboardComponent implements OnInit, AfterViewInit {
	@ViewChild('logBox') logBox: ElementRef;
	@ViewChild('logServer') logAccordion;
	active_index: any;
	gauzyIcon: SafeResourceUrl = './assets/images/logos/logo_Gauzy.svg';
	running = false;
	loading = false;
	restart = false;
	btn: any = {
		name: ServerStatus.START,
		icon: 'arrow-right-outline',
	};
	logContents: any = [];
	isExpandWindow = false;
	logIsOpen = false;
	styles = {
		btnStart: 'button-small',
		icon: 'margin-icon-small',
	};

	constructor(
		private electronService: ElectronService,
		private _cdr: ChangeDetectorRef,
		private _languageSelectorService: LanguageSelectorService,
		private _translateService: TranslateService,
		private _ngZone: NgZone,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) {
		this.electronService.ipcRenderer.on('running_state', (event, arg) => {
			this.loading = false;
			this.btn = {
				name: arg ? ServerStatus.STOP : ServerStatus.START,
				icon: arg ? 'stop-circle-outline' : 'arrow-right-outline',
			};
			this.running = arg;
			event.sender.send('running_state', arg);
			if(this.running) {
				this.restart = false;
			}
			this._cdr.detectChanges();
		});

		this.electronService.ipcRenderer.on('log_state', (event, arg) => {
			if (this.logContents.length < 20) {
				this.logContents.push(arg.msg);
			} else {
				this.logContents.shift();
				this.logContents.push(arg.msg);
			}
			this._cdr.detectChanges();
			this.scrollToBottom();
			console.log(arg);
		});

		this.electronService.ipcRenderer.on('resp_msg', (event, arg) => {
			this.restart = arg?.type === 'restart';
			event.sender.send('resp_msg_server', arg);
			this._cdr.detectChanges();
		});

		this.electronService.ipcRenderer.on('loading_state', (event, arg) => {
			this.loading = arg;
			event.sender.send('loading_state');
			this.electronService.ipcRenderer.send('expand_window');
			this.isExpandWindow = true;
			this.styles.btnStart = 'button-big';
			this.styles.icon = 'margin-icon';
			this.logIsOpen = true;
			this._cdr.detectChanges();
		});

		this.gauzyIcon = this._domSanitizer.bypassSecurityTrustResourceUrl(
			this._environment.PLATFORM_LOGO
		);
	}
	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.on(
			'dashboard_ready',
			(event, arg) => {
				this._ngZone.run(() => {
					if (!!arg.setting?.autoStart ?? true) {
						this.runServer();
					}
				});
			}
		);
		this.electronService.ipcRenderer.on(
			'preferred_language_change',
			(event, language: LanguagesEnum) => {
				this._ngZone.run(() => {
					this._languageSelectorService.setLanguage(
						language,
						this._translateService
					);
					this._cdr.detectChanges();
				});
			}
		);
		from(this.electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language) => {
					this._languageSelectorService.setLanguage(
						language,
						this._translateService
					);
					this._cdr.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnInit(): void {
		this.active_index = 0;
	}

	private scrollToBottom() {
		this.logBox.nativeElement.scrollTop =
			this.logBox.nativeElement.scrollHeight;
	}

	runServer() {
		this.logContents = [];
		this.loading = true;
		this.btn = {
			name: ServerStatus.START,
			icon: '',
		};
		this.logIsOpen = true;
		this.electronService.ipcRenderer.send('run_gauzy_server');
		this.electronService.ipcRenderer.send('expand_window');
		this.isExpandWindow = true;
		this.styles.btnStart = 'button-big';
		this.styles.icon = 'margin-icon';
		this._cdr.detectChanges();
	}

	stopServer() {
		this.loading = true;
		this.btn = {
			name: ServerStatus.STOP,
			icon: '',
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

	public get isServerApi(): boolean {
		return this._environment.IS_SERVER_API;
	}
}
