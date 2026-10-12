import { Component, ViewChild } from '@angular/core';
import { NbPopoverDirective, NbThemeService } from '@nebular/theme';
import { Store } from '@gauzy/ui-core/core';
import { ThemeSelectorComponent } from '../theme-selector.component';

@Component({
	selector: 'gauzy-theme-selector-image',
	templateUrl: './theme-selector-image.component.html',
	styleUrls: ['./theme-selector-image.component.scss'],
	standalone: false
})
export class ThemeSelectorImageComponent extends ThemeSelectorComponent {
	@ViewChild(NbPopoverDirective) private readonly _popover: NbPopoverDirective;

	constructor(
		readonly themeService: NbThemeService,
		readonly store: Store
	) {
		super(themeService, store);
		this.ngOnInit();
	}

	protected get isOpen(): boolean {
		return !!this._popover?.isShown;
	}

	protected selectTheme(theme: string): void {
		this.onSelectedTheme(theme);
		this._popover?.hide();
	}
}
