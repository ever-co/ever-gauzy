import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IEverApp, isCurrentEverApp } from '@gauzy/ui-core/common';
import { AppLauncherService } from '@gauzy/ui-core/core';

/**
 * The App Launcher as a rail: a narrow column at the start edge of the sidebar, one icon per Ever app with its name
 * as a tooltip. The current app carries a bar on its start edge; every other app opens in a new tab (the system
 * browser inside the desktop apps). The layout draws it only for the `rail` position on a wide screen.
 */
@Component({
	selector: 'gauzy-app-rail',
	templateUrl: './app-rail.component.html',
	styleUrls: ['./app-rail.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class AppRailComponent {
	private readonly _launcher = inject(AppLauncherService);
	private readonly _translate = inject(TranslateService);

	protected readonly apps: ReadonlyArray<IEverApp> = this._launcher.apps;

	protected isCurrent(app: IEverApp): boolean {
		return isCurrentEverApp(app);
	}

	/**
	 * The app's name for its tooltip and its link's label, with "Soon" / "Beta" after it when the app is not generally
	 * available: the rail shows only the icon, so the status travels in the name.
	 */
	protected displayName(app: IEverApp): string {
		const statusKey = this.statusKey(app);
		if (!statusKey) {
			return app.shortName;
		}
		return `${app.shortName} · ${this._translate.instant(statusKey)}`;
	}

	private statusKey(app: IEverApp): string | null {
		switch (app.status) {
			case 'soon':
				return 'APP_LAUNCHER.SOON';
			case 'beta':
				return 'APP_LAUNCHER.BETA';
			default:
				return null;
		}
	}

	protected onAppPick(event: MouseEvent, app: IEverApp): void {
		this._launcher.openApp(event, app);
	}
}
