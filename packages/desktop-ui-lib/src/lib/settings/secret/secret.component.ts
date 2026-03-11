import { Component, EventEmitter, Input, NgZone, OnInit, Output } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IDesktopSecret } from '@gauzy/contracts';
import { ElectronService } from '../../electron/services/electron/electron.service';
import { NbCardModule, NbToggleModule, NbIconModule, NbTooltipModule, NbInputModule, NbButtonModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'gauzy-secret',
    templateUrl: './secret.component.html',
    styleUrls: ['./secret.component.scss'],
    imports: [NbCardModule, NbToggleModule, FormsModule, NbIconModule, NbTooltipModule, NbInputModule, NbButtonModule, TranslatePipe]
})
export class SecretComponent implements OnInit {
	private _config: BehaviorSubject<IDesktopSecret>;

	@Output()
	public update: EventEmitter<IDesktopSecret>;

	constructor(private readonly electronService: ElectronService, private readonly ngZone: NgZone) {
		this.update = new EventEmitter<IDesktopSecret>();
		this._config = new BehaviorSubject({
			secret: {
				jwt: '',
				refresh_token: ''
			},
		});
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.on('app_setting', (event, { config }) =>
			this.ngZone.run(async () => {
				if (config?.secret) {
					this.config = {
						secret: {
							...config.secret
						}
					};
				}
			})
		);
	}

	public get config(): IDesktopSecret {
		return this._config.getValue();
	}

	public get config$(): Observable<IDesktopSecret> {
		return this._config.asObservable();
	}

	@Input()
	public set config(value: IDesktopSecret) {
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
}
