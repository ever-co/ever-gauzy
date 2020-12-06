import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { SetupService } from './setup.service';
import { environment } from '../../../environments/environment';

@Component({
	selector: 'ngx-setup',
	templateUrl: './setup.component.html',
	styleUrls: ['./setup.component.scss']
})
export class SetupComponent implements OnInit {
	constructor(
		private electronService: ElectronService,
		private setupService: SetupService,
		private _cdr: ChangeDetectorRef
	) {
		electronService.ipcRenderer.on('setup-data', (event, arg) => {
			this.desktopFeatures.gauzyPlatform = arg.gauzyWindow;
			this.desktopFeatures.timeTracking = arg.timeTrackerWindow;
			this.connectivity.integrated = arg.isLocalServer;
			this.connectivity.localNetwork =
				!arg.isLocalServer && arg.serverUrl !== 'https://api.gauzy.co';
			this.connectivity.live =
				arg.serverUrl && arg.serverUrl === 'https://api.gauzy.co';
			this.thirdParty.activityWatch = arg.aw;
			this.databaseDriver.sqlite = arg.db === 'sqlite';
			this.databaseDriver.postgre = arg.db === 'postgres';
			this.serverConfig.integrated.port = arg.port;
			if (!arg.isLocalServer) {
				this.serverConfig.localNetwork.apiHost = arg.serverUrl
					.split(':')[1]
					.slice(2);
				this.serverConfig.localNetwork.port = arg.serverUrl.split(
					':'
				)[2];
			}
			if (arg.db === 'postgres') {
				this.databaseConfig.postgre = {
					host: arg.dbHost,
					dbPort: arg.dbPort,
					dbName: arg.dbName,
					dbUser: arg.dbUsername,
					dbPassword: arg.dbPassword
				};
			}
		});
	}
	loading: Boolean = false;
	iconAw = './assets/icons/toggle-left.svg';
	statusIcon = 'success';
	awCheck = false;
	awAPI: String = environment.AWHost;
	buttonSave = false;
	desktopFeatures: any = {
		gauzyPlatform: true,
		timeTracking: true
	};

	connectivity: any = {
		integrated: true,
		localNetwork: false,
		live: false
	};

	thirdParty: any = {
		activitywatch: true,
		wakatime: true
	};

	databaseDriver: any = {
		sqlite: true,
		postgre: false
	};

	serverConfig: any = {
		integrated: {
			port: '5620'
		},
		localNetwork: {
			apiHost: '',
			port: ''
		},
		live: {
			url: 'https://api.gauzy.co'
		}
	};

	databaseConfig: any = {
		postgre: {
			host: '',
			dbPort: '',
			dbName: '',
			dbUser: '',
			dbPassword: ''
		}
	};

	connectivityChange(event, key) {
		Object.keys(this.connectivity).forEach((itemKey) => {
			if (itemKey === key) {
				this.connectivity[key] = true;
			} else this.connectivity[itemKey] = false;
		});
	}

	databaseDriverChange(event, key) {
		Object.keys(this.databaseDriver).forEach((itemKey) => {
			if (itemKey === key) this.databaseDriver[key] = true;
			else this.databaseDriver[itemKey] = false;
		});
		this.validation();
	}

	getThirdPartyConfig() {
		if (
			this.desktopFeatures.timeTracking &&
			this.thirdParty.activitywatch
		) {
			return {
				aw: this.thirdParty.activitywatch,
				awHost: environment.AWHost
			};
		}

		if (this.desktopFeatures.timeTracking && this.thirdParty.wakatime) {
			return {
				wakatime: this.thirdParty.wakatime
			};
		}

		return {};
	}

	getServerConfig() {
		if (this.connectivity.integrated) {
			return {
				...this.serverConfig.integrated,
				isLocalServer: true
			};
		}

		if (this.connectivity.localNetwork) {
			const url =
				this.serverConfig.localNetwork.apiHost.indexOf('http') === 0
					? ''
					: 'http://';
			return {
				serverUrl:
					url +
					this.serverConfig.localNetwork.apiHost +
					':' +
					this.serverConfig.localNetwork.port,
				isLocalServer: false
			};
		}

		if (this.connectivity.live) {
			return {
				serverUrl: this.serverConfig.live.url,
				isLocalServer: false
			};
		}
	}

	getDataBaseConfig() {
		if (this.databaseDriver.postgre) {
			return {
				dbHost: this.databaseConfig.postgre.host,
				dbPort: this.databaseConfig.postgre.dbPort,
				dbName: this.databaseConfig.postgre.dbName,
				dbUsername: this.databaseConfig.postgre.dbUser,
				dbPassword: this.databaseConfig.postgre.dbPassword,
				db: 'postgres'
			};
		}

		if (this.databaseDriver.sqlite) {
			return {
				db: 'sqlite'
			};
		}

		return {};
	}

	getFeature() {
		return {
			gauzyWindow: this.desktopFeatures.gauzyPlatform,
			timeTrackerWindow: this.desktopFeatures.timeTracking
		};
	}

	saveChange() {
		const gauzyConfig = {
			...this.getServerConfig(),
			...this.getDataBaseConfig(),
			...this.getThirdPartyConfig(),
			...this.getFeature()
		};

		console.log('config', gauzyConfig);
		this.electronService.ipcRenderer.send('start_server', gauzyConfig);
		this.electronService.ipcRenderer.send('app_is_init');
	}

	pingAw() {
		this.awCheck = false;
		this.setupService
			.pingAw(`${this.awAPI}/api`)
			.then((res) => {
				this.iconAw = './assets/icons/toggle-right.svg';
				this.awCheck = true;
				this.statusIcon = 'success';
				this._cdr.detectChanges();
			})
			.catch((e) => {
				if (e.status === 200) {
					this.iconAw = './assets/icons/toggle-right.svg';
					this.awCheck = true;
					this.statusIcon = 'success';
					this._cdr.detectChanges();
				} else {
					this.iconAw = './assets/icons/toggle-left.svg';
					this.awCheck = true;
					this.statusIcon = 'danger';
					this._cdr.detectChanges();
				}
			});
	}

	validation() {
		const { integrated, localNetwork, live } = this.connectivity;
		const { port } = this.serverConfig.integrated;
		const { apiHost } = this.serverConfig.localNetwork;
		const {
			host,
			dbPort,
			dbName,
			dbUser,
			dbPassword
		} = this.databaseConfig.postgre;

		const { postgre, sqlite } = this.databaseDriver;

		switch (true) {
			case integrated &&
				port &&
				dbPort &&
				host &&
				dbName &&
				dbUser &&
				dbPassword &&
				postgre:
				this.buttonSave = true;
				break;
			case integrated && port && sqlite:
				this.buttonSave = true;
				break;
			case localNetwork &&
				apiHost &&
				this.serverConfig.localNetwork.port > 0:
				this.buttonSave = true;
				break;
			case live:
				this.buttonSave = true;
				break;
			default:
				this.buttonSave = false;
				break;
		}
	}

	openLink(link) {
		this.electronService.ipcRenderer.send('open_browser', {
			url: link
		});
	}

	ngOnInit(): void {}
}
