import { ComponentRef, Injectable, Type, ViewContainerRef } from '@angular/core';
import { NoDataMessageComponent } from '../../../time-tracker/no-data-message/no-data-message.component';

export interface IPlugin {
	id?: string;
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
	 * @returns A promise that resolves to the container with the loaded component.
	 */
	public load(plugin: IPlugin, viewContainerRef: ViewContainerRef): ComponentRef<any> {
		viewContainerRef.clear();

		const { component } = plugin;

		if (component) {
			try {
				return viewContainerRef.createComponent(component);
			} catch (error) {
				const message = 'Error loading component:' + error;
				return this.loadNoDataMessageComponent(message, viewContainerRef);
			}
		} else {
			const message = 'Plugin does not have a component to load.';
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
