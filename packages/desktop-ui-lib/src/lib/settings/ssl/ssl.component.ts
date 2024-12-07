import { Component, EventEmitter, Input, NgZone, OnInit, Output } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IProxyConfig } from '@gauzy/contracts';
import { ElectronService } from '../../electron/services/electron/electron.service';

interface ICheckSslResponse {
	status: boolean;
	message: string;
}

@Component({
	selector: 'gauzy-ssl',
	templateUrl: './ssl.component.html',
	styleUrls: ['./ssl.component.scss']
})
export class SslComponent implements OnInit {
	public isCheckSsl$: BehaviorSubject<boolean>;
	public isValid$: BehaviorSubject<ICheckSslResponse>;
	public isHidden$: BehaviorSubject<boolean>;
	private _config: BehaviorSubject<IProxyConfig>;

	@Output()
	public update: EventEmitter<IProxyConfig>;

	constructor(private readonly electronService: ElectronService, private readonly ngZone: NgZone) {
		this.update = new EventEmitter<IProxyConfig>();
		this.isCheckSsl$ = new BehaviorSubject(false);
		this.isHidden$ = new BehaviorSubject(true);
		this.isValid$ = new BehaviorSubject({ status: true, message: '' });
		this._config = new BehaviorSubject({
			ssl: {
				key: '',
				cert: ''
			},
			secure: true,
			enable: false
		});
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.on('app_setting', (event, { config }) =>
			this.ngZone.run(async () => {
				this.config = config?.secureProxy;
			})
		);

		this.electronService.ipcRenderer.on('check_ssl', (event, response: ICheckSslResponse) =>
			this.ngZone.run(() => {
				this.isValid$.next(response);
				this.isHidden$.next(false);
				this.isCheckSsl$.next(false);
			})
		);
	}

	public get config(): IProxyConfig {
		return this._config.getValue();
	}

	public get config$(): Observable<IProxyConfig> {
		return this._config.asObservable();
	}

	@Input()
	public set config(value: IProxyConfig) {
		if (value) {
			this._config.next(value);
		}
	}

	public onUpdate(): void {
		this.update.emit(this.config);
	}

	public save(event: string): void {
		this.electronService.ipcRenderer.send('save_encrypted_file', event);
	}

	public checkSsl(): void {
		this.isCheckSsl$.next(true);
		this.electronService.ipcRenderer.send('check_ssl');
	}

	public onHide(): void {
		this.isHidden$.next(true);
	}
}
