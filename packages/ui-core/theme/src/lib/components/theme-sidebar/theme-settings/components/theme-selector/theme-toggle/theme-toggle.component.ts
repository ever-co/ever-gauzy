import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NbThemeService } from '@nebular/theme';
import { Store } from '@gauzy/ui-core/core';
import { isDarkThemeName, oppositeThemeName } from '../theme-pairs';

/**
 * One icon in the top bar that switches between the light and the dark theme of the person's theme family (Gauzy
 * Light / Gauzy Dark, Corporate / Cosmic, ...). The full choice of themes stays in Quick settings, the account panel
 * and Settings › General. The switch is kept like any theme choice (`Store.currentTheme`).
 */
@Component({
	selector: 'gauzy-theme-toggle',
	templateUrl: './theme-toggle.component.html',
	styleUrls: ['./theme-toggle.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class ThemeToggleComponent {
	private readonly _themeService = inject(NbThemeService);
	private readonly _store = inject(Store);

	protected readonly isDark = toSignal(
		this._themeService.onThemeChange().pipe(map(({ name }) => isDarkThemeName(name))),
		{
			initialValue: isDarkThemeName(this._themeService.currentTheme)
		}
	);

	protected toggle(): void {
		const next = oppositeThemeName(this._themeService.currentTheme);
		if (!next) {
			return;
		}
		this._store.currentTheme = next;
		this._themeService.changeTheme(next);
	}
}
