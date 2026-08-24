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
	/**
	 * The theme list, rendered as a popover so it opens OVER the page instead of
	 * expanding inside the Quick Settings panel (which gave that panel a
	 * scrollbar and pushed its Settings button below the fold).
	 */
	@ViewChild(NbPopoverDirective) private readonly _popover: NbPopoverDirective;

	constructor(
		readonly themeService: NbThemeService,
		readonly store: Store
	) {
		super(themeService, store);
		this.ngOnInit();
	}

	/**
	 * Whether the theme list is on screen.
	 *
	 * Read straight off the popover rather than mirrored into a field: the panel
	 * is also dismissed by paths this component never sees (a click outside, the
	 * trigger's own toggle), and a cached flag would leave the chevron pointing
	 * up over a list that is already gone.
	 */
	public get isOpen(): boolean {
		return !!this._popover?.isShown;
	}

	/**
	 * Apply a theme and close the list.
	 *
	 * Closing is explicit because the click lands INSIDE the popover, which its
	 * own outside-click strategy does not treat as a dismissal — without this the
	 * list would stay open over the panel after a choice was made.
	 */
	public selectTheme(theme: string): void {
		this.onSelectedTheme(theme);
		this._popover?.hide();
	}
}
