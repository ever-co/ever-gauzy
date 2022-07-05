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
	/**
	 *
	 * @param switchService
	 * @param themeService
	 * @param store
	 */
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
					// If OS theme is dark and the current theme is light does switched, else don't.
					if (!this.isDark.state) this.switchTheme();
				} else {
					// If OS theme is light and the current theme is dark does switched, else don't.
					if (this.isDark.state) this.switchTheme();
				}
			});
		// This part of code should load only one time.
		if (!this.switchService.isAlreadyLoaded) {
			this.ngOnInit();
			// if there is a preferred theme in localStorage don't switch to OS theme
			if (!this.switchService.hasAlreadyPreferredTheme)
				this.getPreferColorOsScheme();
			// lockdown
			this.switchService.isAlreadyLoaded = true;
		}
	}
	/**
	 * this method help to switch to opposite current theme
	 */
	public switchTheme() {
		this.reverseTheme();
	}
	/**
	 * get current OS color and switching to it.
	 */
	public getPreferColorOsScheme() {
		// If OS theme is dark and the current theme is dark too don't switched, else does switched.
		if (window.matchMedia(this.DARK_OS_SCHEME).matches) {
			if (!this.isDark.state) this.switchTheme();
		}
		// If OS theme is light and the current theme is light too don't switched, else does switched.
		if (window.matchMedia(this.LIGHT_OS_SCHEME).matches) {
			if (this.isDark.state) this.switchTheme();
		}
	}
}
