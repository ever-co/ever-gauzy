import { inject, Injectable } from '@angular/core';
import { ID, PluginOSArch, PluginOSType } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { IPlugin } from './plugin-loader.service';

@Injectable({
	providedIn: 'root'
})
export class PluginElectronService {
	private electronService = inject(ElectronService);

	public get plugins(): Promise<IPlugin[]> {
		return this.electronService.ipcRenderer.invoke('plugins::getAll');
	}

	public plugin(name: string): Promise<IPlugin> {
		return this.electronService.ipcRenderer.invoke('plugins::getOne', name);
	}

	public checkInstallation(marketplaceId: ID): Promise<IPlugin> {
		return this.electronService.ipcRenderer.invoke('plugins::check', marketplaceId);
	}

	public activate(plugin: IPlugin) {
		this.electronService.ipcRenderer.send('plugin::activate', plugin.name);
	}

	public load() {
		this.electronService.ipcRenderer.send('plugins::load');
	}

	public initialize() {
		this.electronService.ipcRenderer.send('plugins::initialize');
	}

	public deactivate(plugin: IPlugin) {
		this.electronService.ipcRenderer.send('plugin::deactivate', plugin.name);
	}

	public downloadAndInstall<T>(config: T) {
		this.electronService.ipcRenderer.send('plugin::download', config);
	}

	public uninstall(plugin: IPlugin) {
		this.electronService.ipcRenderer.send('plugin::uninstall', plugin.name);
	}

	public lazyLoader(pluginPath: string) {
		return this.electronService.ipcRenderer.invoke('plugins::lazy-loader', pluginPath);
	}

	public progress<T, U>(callBack?: (message?: string) => T): Observable<{ message?: string; data: U }> {
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
		return this.electronService.ipcRenderer.invoke('plugins::get-os');
	}
}
