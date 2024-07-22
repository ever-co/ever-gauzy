import { ComponentRef, Injectable, Type, ViewContainerRef } from '@angular/core';
import * as path from 'path';
import { NoDataMessageComponent } from '../../../time-tracker/no-data-message/no-data-message.component';

export interface IPlugin {
	id?: string;
	renderer?: string;
	pathname?: string;
	name: string;
	version: string;
	isActivate: boolean;
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
	/**
	 * Loads a plugin component into the provided container.
	 * @param plugin - The plugin to load.
	 * @param viewContainerRef - The ViewContainerRef where the component will be loaded.
	 * @returns A promise that resolves to the ComponentRef of the loaded component.
	 */
	public async load(plugin: IPlugin, viewContainerRef: ViewContainerRef): Promise<ComponentRef<any>> {
		viewContainerRef.clear();

		if (!plugin.renderer) {
			return this.loadNoDataMessageComponent('Plugin does not have a component to load.', viewContainerRef);
		}

		try {
			const componentModule = await import(/*webpackIgnore:true*/ path.join(plugin.pathname, plugin.renderer));
			const componentRef = viewContainerRef.createComponent(componentModule.default);
			return componentRef;
		} catch (error) {
			const message = 'Error loading component: ' + error;
			return this.loadNoDataMessageComponent(message, viewContainerRef);
		}
	}

	/**
	 * Loads a NoDataMessageComponent with a specified message.
	 * @param message - The message to display.
	 */
	private loadNoDataMessageComponent(message: string, viewContainerRef: ViewContainerRef) {
		try {
			const componentRef = viewContainerRef.createComponent(NoDataMessageComponent);
			const instance: NoDataMessageComponent = componentRef.instance;
			instance.message = message;
			console.warn(message);
			return componentRef;
		} catch (error) {
			console.error('Error loading NoDataMessageComponent:', error);
		}
	}
}
