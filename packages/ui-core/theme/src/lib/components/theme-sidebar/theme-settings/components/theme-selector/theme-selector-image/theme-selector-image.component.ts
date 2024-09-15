import { Component } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { Store } from '@gauzy/ui-core/core';
import { ThemeSelectorComponent } from '../theme-selector.component';

@Component({
	selector: 'gauzy-theme-selector-image',
	templateUrl: './theme-selector-image.component.html',
	styleUrls: ['./theme-selector-image.component.scss']
})
export class ThemeSelectorImageComponent extends ThemeSelectorComponent {
	isOpen: boolean = false;

	constructor(readonly themeService: NbThemeService, readonly store: Store) {
		super(themeService, store);
		this.ngOnInit();
	}
}
