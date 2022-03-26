import { Component } from '@angular/core';
import { ThemeSelectorComponent } from '../theme-selector.component';
import { NbThemeService } from '@nebular/theme';
import { Store } from '../../../../../../../@core/services/store.service';

@Component({
	selector: 'gauzy-switch-theme',
	templateUrl: './switch-theme.component.html',
	styleUrls: ['./switch-theme.component.scss']
})
export class SwitchThemeComponent extends ThemeSelectorComponent {
	constructor(readonly themeService: NbThemeService, readonly store: Store) {
		super(themeService, store);
		this.ngOnInit();
	}

	switchTheme() {
		this.reverseTheme();
	}
}
