import { inject, Injectable } from '@angular/core';
import { ID, PluginOSArch, PluginOSType } from '@gauzy/contracts';
import { EMPTY, Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import type { IPlugin } from './plugin-loader.service';

@Injectable({
	providedIn: 'root'
})
export class PluginElectronService {
	private readonly electronService = inject(ElectronService, { optional: true });

	public get isDesktop(): boolean {
		if (!this.electronService) {
			return false;
		}
		return this.electronService.isElectron;
	}

	public get plugins(): Promise<IPlugin[]> {
		if (!this.isDesktop) {
			return Promise.resolve([]);
		}
		return this.electronService.ipcRenderer.invoke('plugins::getAll');
	}

	public plugin(name: string): Promise<IPlugin> {
		if (!this.isDesktop) {
			return Promise.resolve(null);
		}
		return this.electronService.ipcRenderer.invoke('plugins::getOne', name);
	}

	public checkInstallation(marketplaceId: ID): Promise<IPlugin> {
		if (!this.isDesktop) {
			return Promise.resolve(null);
		}
		return this.electronService.ipcRenderer.invoke('plugins::check', marketplaceId);
	}

	public activate(plugin: IPlugin) {
		if (!this.isDesktop) return;
		this.electronService.ipcRenderer.send('plugin::activate', plugin.name);
	}

	public load() {
		if (!this.isDesktop) return;
		this.electronService.ipcRenderer.send('plugins::load');
	}

	public initialize() {
		if (!this.isDesktop) return;
		this.electronService.ipcRenderer.send('plugins::initialize');
	}

	public deactivate(plugin: IPlugin) {
		if (!this.isDesktop) return;
		this.electronService.ipcRenderer.send('plugin::deactivate', plugin.name);
	}

	public downloadAndInstall<T>(config: T) {
		if (!this.isDesktop) return;
		this.electronService.ipcRenderer.send('plugin::download', config);
	}

	public uninstall(input: { marketplaceId: ID; name?: string; id?: ID }) {
		if (!this.isDesktop) return;
		this.electronService.ipcRenderer.send('plugin::uninstall', input);
	}

	public completeInstallation(marketplaceId: string, installationId: string): void {
		if (!this.isDesktop) return;
		this.electronService.ipcRenderer.send('plugin::complete::installation', {
			marketplaceId,
			installationId
		});
	}

	public lazyLoader(pluginPath: string) {
		if (!this.isDesktop) {
			return Promise.resolve(null);
		}
		return this.electronService.ipcRenderer.invoke('plugins::lazy-loader', pluginPath);
	}

	public progress<T, U>(callBack?: (message?: string) => T): Observable<{ message?: string; data: U }> {
		if (!this.isDesktop) {
			return EMPTY;
		}
		return new Observable<{ message?: string; data: U }>((observer) => {
			const channel = 'plugin::status';

			const listener = (_: any, arg: { status: string; message?: string; data?: U }) => {
				try {
					switch (arg.status) {
						case 'success':
							observer.next({ message: arg.message, data: arg.data });
							observer.complete();
							break;
						case 'inProgress':
							callBack?.(arg.message);
							break;
						case 'error':
						default:
							observer.error(arg.message);
							break;
					}
				} catch (error) {
					observer.error(error);
				}
			};

			this.electronService.ipcRenderer.on(channel, listener);

			return () => {
				this.electronService.ipcRenderer.removeListener(channel, listener);
			};
		});
	}

	public get status(): Observable<{ status: string; message?: string }> {
		if (!this.isDesktop) {
			return EMPTY;
		}
		return new Observable((observer) => {
			const channel = 'plugin::status';
			const listener = (_, arg: { status: string; message?: string }) => {
				observer.next(arg);
			};

			this.electronService.ipcRenderer.on(channel, listener);

			return () => {
				this.electronService.ipcRenderer.removeListener(channel, listener);
			};
		});
	}

	public getOS(): Promise<{ platform: PluginOSType; arch: PluginOSArch }> {
		if (!this.isDesktop) {
			return Promise.resolve(null);
		}
		return this.electronService.ipcRenderer.invoke('plugins::get-os');
	}
}
