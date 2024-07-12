import { ApplicationRef, ComponentRef, Injectable, Type, ViewContainerRef } from '@angular/core';

export interface IPlugin {
	name: string;
	version: string;
	initialize(): void;
	dispose(): void;
	activate(): void;
	deactivate(): void;
	component?: Type<any>;
}

@Injectable({
	providedIn: 'root'
})
export class PluginLoaderService {
	private componentRef: ComponentRef<any> | null = null;

	constructor(private appRef: ApplicationRef) {}

	/**
	 * Loads a plugin component into the provided container.
	 * @param plugin - The plugin to load.
	 * @param container - The container to load the component into.
	 */
	public async loadComponent(plugin: IPlugin, container: ViewContainerRef): Promise<void> {
		this.unloadComponent();

		const { component } = plugin;

		if (component) {
			try {
				this.componentRef = container.createComponent(component);
				this.appRef.attachView(this.componentRef.hostView);
			} catch (error) {
				console.error('Error loading component:', error);
				this.componentRef = null;
			}
		} else {
			console.warn('Plugin does not have a component to load.');
		}
	}

	/**
	 * Unloads the currently loaded component, if any.
	 */
	public unloadComponent(): void {
		if (this.componentRef) {
			try {
				this.appRef.detachView(this.componentRef.hostView);
				this.componentRef.destroy();
				this.componentRef = null;
			} catch (error) {
				console.error('Error unloading component:', error);
			}
		}
	}
}
