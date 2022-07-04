import { Component, Input } from '@angular/core';
import { ThemeSelectorComponent } from '../theme-selector.component';
import { NbThemeService } from '@nebular/theme';
import { Store } from '../../../../../../../@core/services/store.service';

@Component({
	selector: 'gauzy-switch-theme',
	templateUrl: './switch-theme.component.html',
	styleUrls: ['./switch-theme.component.scss']
})
export class SwitchThemeComponent extends ThemeSelectorComponent {
	@Input() hasText: boolean = true;

	constructor(readonly themeService: NbThemeService, readonly store: Store) {
		super(themeService, store);
		// Listerning event and switching to current OS color theme
		window
			.matchMedia('(prefers-color-scheme: dark)')
			.addEventListener('change', (event) => {
				event.matches
					? this.isDark.state
						? null
						: this.switchTheme()
					: !this.isDark.state
					? null
					: this.switchTheme();
			});
		this.ngOnInit();
		this.getPreferColorOsScheme();
	}

	switchTheme() {
		this.reverseTheme();
	}
	/**
	 * get current OS color and switching to it.
	 */
	public getPreferColorOsScheme() {
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			this.isDark.state ? null : this.switchTheme();
		}

		if (window.matchMedia('(prefers-color-scheme: light)').matches) {
			this.isDark.state ? this.switchTheme() : null;
		}
	}
}
