import { Component, EventEmitter, Input, NgZone, OnInit, Output } from '@angular/core';
import { ElectronService } from '@gauzy/desktop-ui-lib';
import { IProxyConfig } from '@gauzy/contracts';

@Component({
	selector: 'gauzy-ssl',
	templateUrl: './ssl.component.html',
	styleUrls: ['./ssl.component.scss']
})
export class SslComponent implements OnInit {
	private _config: IProxyConfig;
	@Output()
	public update: EventEmitter<IProxyConfig>;

	constructor(private readonly electronService: ElectronService, private readonly ngZone: NgZone) {
		this.update = new EventEmitter<IProxyConfig>();
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.on('app_setting', (event, { config }) =>
			this.ngZone.run(async () => {
				this.config = config?.secureProxy;
			})
		);
	}

	public get config(): IProxyConfig {
		return this._config;
	}

	@Input()
	public set config(value: IProxyConfig) {
		if (value) {
			this._config = value;
		}
	}

	public onUpdate(): void {
		this.update.emit(this.config);
	}

	public save(event: string): void {
		this.electronService.ipcRenderer.send('save_encrypted_file', event);
	}
}
