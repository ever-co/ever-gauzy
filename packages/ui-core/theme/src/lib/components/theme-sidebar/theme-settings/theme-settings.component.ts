import { Component, OnDestroy, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import { NbSidebarService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';
import { environment } from '@gauzy/ui-config';

/**
 * Minimal surface of the Chatwoot browser SDK that this component uses.
 * The SDK is loaded at runtime by the shell (see AppComponent.loadChatwoot),
 * so it may legitimately be absent.
 */
interface IChatwootWidget {
	toggle(state?: 'open' | 'close'): void;
}

/** Tag of the Nebular sidebar this component is rendered into. */
export const QUICK_SETTINGS_SIDEBAR_TAG = 'settings_sidebar';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-theme-settings',
    styleUrls: ['./theme-settings.component.scss'],
    templateUrl: './theme-settings.component.html',
    standalone: false
})
export class ThemeSettingsComponent implements AfterViewChecked, OnDestroy {
	private state: boolean;

	/**
	 * Support chat is only offered when this deployment configured a Chatwoot
	 * website token: AppComponent only injects the SDK in that case, so without
	 * a token there would be no widget to open.
	 */
	public readonly isSupportChatAvailable: boolean = !!environment.CHATWOOT_SDK_TOKEN;

	constructor(private readonly sidebarService: NbSidebarService, private readonly router: Router) {}

	ngAfterViewChecked(): void {
		this.sidebarService
			.getSidebarState(QUICK_SETTINGS_SIDEBAR_TAG)
			.pipe(
				tap((state) => (this.state = state === 'expanded' ? true : false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	/**
	 * Closes the quick settings sidebar.
	 *
	 * Collapses rather than toggles: this is only ever called to close the panel
	 * (the X button and the outside click), and pages that need to know whether
	 * the panel opened or closed listen to the sidebar's expand/collapse events.
	 */
	public closeSidebar() {
		this.sidebarService.collapse(QUICK_SETTINGS_SIDEBAR_TAG);
	}

	/**
	 *
	 * @param event
	 */
	public onClickOutside(event: boolean) {
		if (!event && this.state) this.closeSidebar();
	}

	/**
	 * Navigates to the settings page and closes the quick settings sidebar.
	 */
	public navigateToSettings() {
		this.router.navigate(['/pages/settings']);
		this.closeSidebar();
	}

	/**
	 * Navigates to an application route and closes the quick settings sidebar.
	 *
	 * @param commands router commands, e.g. ['/pages/help']
	 */
	public navigateTo(commands: string[]) {
		this.router.navigate(commands);
		this.closeSidebar();
	}

	/**
	 * Opens the Chatwoot support conversation.
	 *
	 * The widget's launcher bubble is suppressed (`hideMessageBubble`), so this
	 * entry is the only way in. Reading `$chatwoot` off the window rather than
	 * caching it matters: the SDK assigns it asynchronously once its script has
	 * loaded, and it never appears at all when no website token is configured.
	 */
	public openSupportChat() {
		const widget = (window as unknown as { $chatwoot?: IChatwootWidget }).$chatwoot;

		if (!widget) {
			return;
		}

		widget.toggle('open');
		this.closeSidebar();
	}
}
