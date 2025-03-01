import {
	Compiler,
	ComponentRef,
	Injectable,
	Injector,
	Type,
	ViewContainerRef,
	ɵcreateInjector as createInjector,
	isStandalone
} from '@angular/core';
import { IPlugin as IPluginBase } from '@gauzy/contracts';
import { NoDataMessageComponent } from '../../../time-tracker/no-data-message/no-data-message.component';
import { PluginElectronService } from './plugin-electron.service';

export interface IPlugin extends IPluginBase {
	id?: string;
	renderer?: string;
	pathname?: string;
	logo?: string;
	installed?: boolean;
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
	constructor(
		private compiler: Compiler,
		private injector: Injector,
		private pluginElectronService: PluginElectronService
	) {}

	/**
	 * Dynamically loads an Angular Module or a Standalone Component.
	 * @param plugin - The plugin metadata containing the module or component path.
	 * @param viewContainerRef - The container where the plugin should be loaded.
	 * @param inputs - Optional inputs to pass to the loaded component.
	 * @returns A promise resolving to the loaded component reference.
	 */
	public async load(
		plugin: IPlugin,
		viewContainerRef: ViewContainerRef,
		inputs?: Record<string, any>
	): Promise<ComponentRef<any>> {
		viewContainerRef.clear();

		if (!plugin.renderer) {
			return this.loadFallbackComponent('Plugin does not have a component to load.', viewContainerRef);
		}

		try {
			// Import the module/component dynamically
			const importedModule = await this.pluginElectronService.lazyLoader(plugin.renderer);

			// Get the main exported item (component or module)
			const exportedEntries = Object.entries(importedModule);
			const mainExport = this.findMainExport(exportedEntries, plugin.renderer);

			if (!mainExport) {
				throw new Error(`No valid Angular component or module found in '${plugin.renderer}'`);
			}

			// Handle the component based on its type
			if (this.isStandaloneComponent(mainExport)) {
				return this.loadStandaloneComponent(mainExport, viewContainerRef, inputs);
			} else if (this.isNgModule(mainExport)) {
				return this.loadModuleWithComponent(mainExport, viewContainerRef, inputs);
			} else {
				throw new Error(`Exported entity in '${plugin.renderer}' is not a valid Angular component or module.`);
			}
		} catch (error) {
			const errorMessage = `Error loading plugin '${plugin.renderer}': ${error.message}`;
			console.error(errorMessage, error);
			return this.loadFallbackComponent(errorMessage, viewContainerRef);
		}
	}

	/**
	 * Finds the main export from the imported module.
	 * Prioritizes items marked as default exports or named after the file.
	 */
	private findMainExport(exportedEntries: [string, any][], fileName: string): Type<any> | null {
		// Try to find default export first
		const defaultExport = exportedEntries.find(([key]) => key === 'default');
		if (defaultExport) return defaultExport[1];

		// Extract the base name without extension
		const baseName = fileName
			.split('/')
			.pop()
			?.replace(/\.\w+$/, '');

		// Look for export that matches the file name
		const namedExport = exportedEntries.find(
			([key]) =>
				key.toLowerCase() === baseName?.toLowerCase() ||
				key.toLowerCase() === `${baseName}Component`.toLowerCase() ||
				key.toLowerCase() === `${baseName}Module`.toLowerCase()
		);
		if (namedExport) return namedExport[1];

		// Fall back to first valid Angular component or module
		return (
			exportedEntries.find(([_, value]) => this.isStandaloneComponent(value) || this.isNgModule(value))?.[1] ||
			null
		);
	}

	/**
	 * Checks if the provided type is a Standalone Component.
	 */
	private isStandaloneComponent(type: any): boolean {
		// Using public API if available
		if (typeof isStandalone === 'function') {
			return isStandalone(type);
		}
		// Fallback to internal property check
		return !!(type.ɵcmp && type.ɵcmp.standalone);
	}

	/**
	 * Checks if the provided type is an Angular Module.
	 */
	private isNgModule(type: any): boolean {
		return !!type.ɵmod;
	}

	/**
	 * Loads a standalone component into the view container.
	 */
	private loadStandaloneComponent(
		componentType: Type<any>,
		viewContainerRef: ViewContainerRef,
		inputs?: Record<string, any>
	): ComponentRef<any> {
		console.debug(`Loading Standalone Component`);
		const componentRef = viewContainerRef.createComponent(componentType, { injector: this.injector });

		if (inputs) {
			this.setComponentInputs(componentRef, inputs);
		}

		return componentRef;
	}

	/**
	 * Loads a component from an Angular module.
	 */
	private async loadModuleWithComponent(
		moduleType: Type<any>,
		viewContainerRef: ViewContainerRef,
		inputs?: Record<string, any>
	): Promise<ComponentRef<any>> {
		console.debug(`Loading Angular Module`);
		const moduleFactory = await this.compiler.compileModuleAsync(moduleType);
		const moduleRef = moduleFactory.create(this.injector);

		// Find the component to render
		let componentType: Type<any> | undefined;

		// First, check if the module has a specific entryComponent property
		if (moduleType.prototype.entryComponent) {
			componentType = moduleType.prototype.entryComponent;
		}
		// Then check standard declarations
		else if ((moduleType as any).ɵmod?.declarations?.length > 0) {
			componentType = (moduleType as any).ɵmod.declarations[0];
		}

		if (!componentType) {
			throw new Error(`Module does not declare any components or specify an entry component.`);
		}

		// Create the component with the module's injector
		const componentRef = viewContainerRef.createComponent(componentType, {
			injector: createInjector(moduleType, this.injector)
		});

		if (inputs) {
			this.setComponentInputs(componentRef, inputs);
		}

		return componentRef;
	}

	/**
	 * Sets input properties on a component.
	 */
	private setComponentInputs(componentRef: ComponentRef<any>, inputs: Record<string, any>): void {
		Object.entries(inputs).forEach(([key, value]) => {
			if (componentRef.instance[key] !== undefined) {
				componentRef.instance[key] = value;
			}
		});
		componentRef.changeDetectorRef.detectChanges();
	}

	/**
	 * Loads a fallback message component if the plugin fails to load.
	 */
	private loadFallbackComponent(
		message: string,
		viewContainerRef: ViewContainerRef
	): ComponentRef<NoDataMessageComponent> {
		console.warn(`Fallback component loaded: ${message}`);
		const componentRef = viewContainerRef.createComponent(NoDataMessageComponent);
		componentRef.instance.message = message;
		return componentRef;
	}
}
