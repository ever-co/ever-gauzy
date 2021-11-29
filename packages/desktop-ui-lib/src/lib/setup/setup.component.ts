import {
	Component,
	OnInit,
	ChangeDetectorRef,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef
} from '@angular/core';
import { SetupService } from './setup.service';
import { NbDialogService } from '@nebular/theme';
import { AlertComponent } from '../../lib/dialogs/alert/alert.component';
import { ElectronServices } from '../electron/services';

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

@Component({
	selector: 'ngx-setup',
	templateUrl: './setup.component.html',
	styleUrls: ['./setup.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SetupComponent implements OnInit {
	@ViewChild('dialogOpenBtn') btnDialogOpen: ElementRef<HTMLElement>;
	constructor(
		private setupService: SetupService,
		private _cdr: ChangeDetectorRef,
		private dialogService: NbDialogService,
		private electronService: ElectronServices
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

		electronService.ipcRenderer.on('setup-progress', (event, arg) => {
			const validMessage = this.defaultMessage.findIndex(
				(item) => arg.msg.indexOf(item) > -1
			);
			if (validMessage > -1) {
				if (
					validMessage === 0 &&
					arg.msg.indexOf('Found 0 users in DB') < 0
				) {
					this.progressSetup = 100;
					this.progressMessage = arg.msg;
				} else {
					if (arg.msg.indexOf('SEEDED PRODUCTION DATABASE') > -1) {
						const leftProgress = 100 - this.progressSetup;
						this.progressSetup += leftProgress;
					} else {
						this.progressSetup += 3;
					}
					this.progressMessage = arg.msg;
				}
			}
			this._cdr.detectChanges();
		});
	}
	appName: string = this.electronService.remote.app.getName();
	loading: Boolean = false;
	iconAw = './assets/icons/toggle-left.svg';
	statusIcon = 'success';
	awCheck = false;
	awAPI: String = 'http://localhost:5600';
	buttonSave = false;
	gauzyIcon =
		this.appName === 'gauzy-desktop-timer' || this.appName === 'gauzy-server'
			? './assets/images/logos/logo_Gauzy.svg'
			: '../assets/images/logos/logo_Gauzy.svg';
	desktopFeatures: any = {
		gauzyPlatform: this.appName === 'gauzy-desktop-timer' ? false : true,
		timeTracking: this.appName === 'gauzy-server' ? false : true
	};

	connectivity: any = {
		integrated: this.appName === 'gauzy-desktop-timer' ? false : true,
		localNetwork: this.appName === 'gauzy-desktop-timer' ? true : false,
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
			port: '5620',
			portUi: '8084'
		},
		localNetwork: {
			apiHost: '127.0.0.1',
			port: '5620'
		},
		live: {
			url: 'https://api.gauzy.co'
		}
	};

	databaseConfig: any = {
		postgre: {
			host: 'localhost',
			dbPort: '5432',
			dbName: 'postgres',
			dbUser: 'postgres',
			dbPassword: ''
		}
	};

	showPassword = false;

	progressSetup = 0;
	progressMessage = 'Waiting ...';
	onProgress = false;

	defaultMessage: any = [
		'users in DB',
		'Found 0 users in DB',
		'CLEANING UP FROM PREVIOUS RUNS...',
		'CLEANED UP',
		'RESET DATABASE SUCCESSFUL',
		'SEEDING PRODUCTION DATABASE...',
		'SEEDING Changelog',
		'SEEDING Countries',
		'SEEDING Currencies',
		'SEEDING Languages',
		'SEEDING PRODUCTION REPORTS DATABASE...',
		'SEEDING Default Report Category & Report',
		'CLEANING UP REPORT IMAGES...',
		'CLEANED UP REPORT IMAGES',
		'SEEDED PRODUCTION REPORTS DATABASE',
		'Database Reports Seed completed',
		'SEEDING Default Email Templates',
		'SEEDING Skills',
		'SEEDING Contacts',
		'SEEDING Default Employee Invite',
		'SEEDING Default General Goal Setting',
		'SEEDING Default Goal Template',
		'SEEDING Default Goal KPI Template',
		'SEEDING Default Key Result Template',
		'SEEDING Default Time Off Policy',
		'SEEDING Default Integration Types',
		'SEEDING Default Integrations',
		'SEEDED PRODUCTION DATABASE'
	];

	dialogData: any = {
		title: 'Success',
		message: '',
		status: 'success'
	};

	runApp: boolean = false;
	welcomeTitle: string = 'GAUZY PLATFORM WIZARD';
	welcomeLabel: string = `
		Gauzy Desktop App provides the full
		functionality of the Gauzy Platform
		available directly on your desktop
		computer or a laptop. In addition,
		it allows tracking work time,
		activity recording, and the ability
		to receive tracking
		reminders/notifications.
	`;

	welcomeText() {
		switch (this.appName) {
			case 'gauzy-server':
				this.welcomeTitle = 'GAUZY SERVER INSTALLATION WIZARD';
				this.welcomeLabel = `
					Gauzy Desktop App provides the full
					functionality of the Gauzy Platform
					available directly on your desktop
					computer or a laptop. In addition,
					it allows tracking work time,
					activity recording, and the ability
					to receive tracking
					reminders/notifications.
				`;
				break;
		
			default:
				break;
		}
	}

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
		return {
			aw: this.thirdParty.activitywatch,
			awHost: this.awAPI,
			wakatime: this.thirdParty.wakatime
		};
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

		log.info(`Server Config:`, this.serverConfig);
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

	saveAndRun() {
		if (this.connectivity.integrated) {
			this.onProgress = true;
		}
		const gauzyConfig = {
			...this.getServerConfig(),
			...this.getDataBaseConfig(),
			...this.getThirdPartyConfig(),
			...this.getFeature()
		};

		this.electronService.ipcRenderer.send('start_server', gauzyConfig);
		this.electronService.ipcRenderer.send('app_is_init');
	}

	saveChange() {
		this.runApp = true;
		this.checkConnection(true);
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
		const { port, portUi } = this.serverConfig.integrated;
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
				portUi &&
				dbPort &&
				host &&
				dbName &&
				dbUser &&
				dbPassword &&
				postgre:
				this.buttonSave = true;
				break;
			case integrated && port && portUi && sqlite:
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

	getInputType() {
		if (this.showPassword) {
			return 'text';
		}
		return 'password';
	}

	toggleShowPassword() {
		this.showPassword = !this.showPassword;
	}

	checkDatabaseConn() {
		this.electronService.ipcRenderer.send('check_database_connection', {
			...this.getDataBaseConfig()
		});
	}

	checkServerConn() {
		const serverHostOptions = this.getServerConfig();
		console.log('server host', serverHostOptions);
		this.setupService
			.pingServer({
				host: serverHostOptions.serverUrl
			})
			.then((res) => {
				if (this.runApp) {
					this.saveAndRun();
				} else {
					this.dialogData = {
						title: 'Succes',
						message: `Connection to Server ${serverHostOptions.serverUrl} Succeeds`,
						status: 'success'
					};
					let elBtn: HTMLElement = this.btnDialogOpen.nativeElement;
					elBtn.click();
				}
			})
			.catch((e) => {
				if (e.status === 404) {
					if (this.runApp) {
						this.saveAndRun();
					} else {
						this.dialogData = {
							title: 'Succes',
							message: `Connection to Server ${serverHostOptions.serverUrl} Succeeds`,
							status: 'success'
						};
						let elBtn: HTMLElement = this.btnDialogOpen
							.nativeElement;
						elBtn.click();
					}
				} else {
					this.dialogData = {
						title: 'Error',
						message: e.message,
						status: 'danger'
					};
					let elBtn: HTMLElement = this.btnDialogOpen.nativeElement;
					elBtn.click();
				}
			});
	}

	checkConnection(notRun = false) {
		this.runApp = notRun;
		if (this.connectivity.integrated) {
			this.checkDatabaseConn();
		} else {
			this.checkServerConn();
		}
	}

	open(hasBackdrop: boolean) {
		this.dialogService.open(AlertComponent, {
			context: {
				data: this.dialogData
			}
		});
	}

	openfromhere(hasBackdrop: boolean) {
		this.open(hasBackdrop);
	}

	ngOnInit(): void {
		this.welcomeText();
		this.electronService.ipcRenderer.on('database_status', (event, arg) => {
			// this.open(true);
			// this._cdr.detectChanges();
			if (arg.status) {
				this.dialogData = {
					title: 'Success',
					message: arg.message,
					status: 'success'
				};
			} else {
				this.dialogData = {
					title: 'Warning',
					message: arg.message,
					status: 'danger'
				};
			}

			if (arg.status && this.runApp) {
				this.saveAndRun();
			} else {
				let elBtn: HTMLElement = this.btnDialogOpen.nativeElement;
				elBtn.click();
			}
		});
		this.validation();
	}
}
