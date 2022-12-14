import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { ElectronService } from '../../electron/services';

@Component({
	selector: 'gauzy-about',
	templateUrl: './about.component.html',
	styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
	private _application = {
		name: 'gauzy-dev',
		version: 'dev',
		iconPath: ''
	};
	constructor(
		private _dialogRef: NbDialogRef<AboutComponent>,
		private readonly _electronService: ElectronService
	) {}

	ngOnInit(): void {}

	public close() {
		this._dialogRef.close();
	}

	public openLink(link: string) {
		switch (link) {
			case 'EVER':
				this._electronService.shell.openExternal('https://ever.co');
				break;
			case 'TOS':
				this._electronService.shell.openExternal(
					'https://gauzy.co/tos'
				);
				break;
			case 'PRIVACY':
				this._electronService.shell.openExternal(
					'https://gauzy.co/privacy'
				);
				break;
			default:
				break;
		}
	}

	public get application() {
		this._application = {
			name: this._electronService.remote.app
				.getName()
				.split('-')
				.join(' ')
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) =>
					letter.toUpperCase()
				),
			version: this._electronService.remote.app.getVersion(),
			iconPath: './assets/images/logos/logo_Gauzy.svg'
		};
		return this._application;
	}
}
