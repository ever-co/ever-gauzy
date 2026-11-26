import { ChangeDetectionStrategy, Component, inject, Input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { APP_LAUNCHER_PLACEMENTS, AppLauncherPlacement } from '@gauzy/ui-core/common';
import { AppLauncherService } from '@gauzy/ui-core/core';

let nextGroupNumber = 0;

/** The label of each position's tile. */
const LABEL_KEYS: Readonly<Record<AppLauncherPlacement, string>> = {
	sidebar: 'APP_LAUNCHER.PLACEMENT_SIDEBAR',
	header: 'APP_LAUNCHER.PLACEMENT_HEADER',
	rail: 'APP_LAUNCHER.PLACEMENT_RAIL'
};

/**
 * Where the person keeps the App Launcher, as three picture tiles: Sidebar, Top bar, Left rail (Settings › General ›
 * Preferences). A pick applies at once and is kept in this browser (Ever Teams' preference: same key, same values).
 * Shown only when the deployment links another Ever app.
 */
@Component({
	selector: 'ga-app-launcher-placement',
	templateUrl: './app-launcher-placement.component.html',
	styleUrls: ['./app-launcher-placement.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	host: { '[attr.hidden]': 'launcher.isAvailable ? null : ""' }
})
export class AppLauncherPlacementComponent {
	readonly launcher = inject(AppLauncherService);

	/**
	 * Whether the tiles carry their own title and description. Off where the page already shows them beside the
	 * tiles (a settings row): the title then stays for screen readers only.
	 */
	@Input() showHeading = true;

	readonly placements = APP_LAUNCHER_PLACEMENTS;
	readonly labelKeys = LABEL_KEYS;
	readonly groupName = `ga-app-launcher-placement-${++nextGroupNumber}`;

	/** The browser refused to keep the last pick (private mode, storage full): it lasts until the page reloads. */
	readonly notSaved = signal(false);

	pick(placement: AppLauncherPlacement): void {
		const isStored = this.launcher.setPlacement(placement);
		this.notSaved.set(!isStored);
	}
}
