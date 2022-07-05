import { Component, Input } from '@angular/core';
import { ThemeSelectorComponent } from '../theme-selector.component';
import { NbThemeService } from '@nebular/theme';
import { Store } from '../../../../../../../@core/services/store.service';
import { SwitchThemeService } from './switch-theme.service';

@Component({
	selector: 'gauzy-switch-theme',
	templateUrl: './switch-theme.component.html',
	styleUrls: ['./switch-theme.component.scss']
})
export class SwitchThemeComponent extends ThemeSelectorComponent {
	private DARK_OS_SCHEME = '(prefers-color-scheme: dark)';
	private LIGHT_OS_SCHEME = '(prefers-color-scheme: light)';
	@Input() hasText: boolean = true;

	constructor(
		private readonly switchService: SwitchThemeService,
		readonly themeService: NbThemeService,
		readonly store: Store
	) {
		super(themeService, store);
		// Listerning event and switching to current OS color theme
		window
			.matchMedia(this.DARK_OS_SCHEME)
			.addEventListener('change', (event) => {
				if (event.matches) {
					if (!this.isDark.state) this.switchTheme();
				} else {
					if (this.isDark.state) this.switchTheme();
				}
			});
		if (!this.switchService.isAlreadyLoaded) {
			this.ngOnInit();
			this.getPreferColorOsScheme();
			this.switchService.isAlreadyLoaded = true;
		}
	}

	switchTheme() {
		this.reverseTheme();
	}
	/**
	 * get current OS color and switching to it.
	 */
	public getPreferColorOsScheme() {
		if (window.matchMedia(this.DARK_OS_SCHEME).matches) {
			if (!this.isDark.state) this.switchTheme();
		}

		if (window.matchMedia(this.LIGHT_OS_SCHEME).matches) {
			if (this.isDark.state) this.switchTheme();
		}
	}
}
