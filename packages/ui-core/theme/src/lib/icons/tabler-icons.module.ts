import { inject, NgModule } from '@angular/core';
import { NbIconLibraries } from '@nebular/theme';
import { evaToTablerIcons } from './eva-to-tabler-icons.map';

@NgModule()
export class NbTablerIconsModule {
	private readonly _iconLibraries = inject(NbIconLibraries);

	constructor() {
		this.registerTablerPack();
	}

	registerTablerPack() {
		// We register this pack as 'eva' to maintain backward compatibility with existing usages of the Eva icon pack in templates and configuration.
		this._iconLibraries.registerSvgPack('eva', evaToTablerIcons);
		this._iconLibraries.setDefaultPack('eva');
	}
}
