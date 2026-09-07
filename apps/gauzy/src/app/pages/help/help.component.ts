import { Component, Inject, OnDestroy } from '@angular/core';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';

/**
 * Minimal surface of the Chatwoot browser SDK used here. The SDK is loaded at
 * runtime by the shell (see AppComponent.loadChatwoot) only when a website
 * token is configured, so `window.$chatwoot` may be absent or arrive late.
 */
interface IChatwootWidget {
	toggle(state?: 'open' | 'close'): void;
}

@Component({
	selector: 'ngx-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.scss'],
	standalone: false
})
export class HelpComponent implements OnDestroy {
	/** Support chat is only offered when this deployment configured a Chatwoot website token. */
	readonly isSupportChatAvailable: boolean;

	/** GitHub repo base, for the source / issue links. */
	readonly repoBaseUrl: string;

	/** The one pending `chatwoot:ready` handler, kept so repeated clicks don't
	 *  stack listeners and navigating away removes it (`once` only cleans up
	 *  after the event actually fires). */
	private pendingOpen: (() => void) | null = null;

	constructor(@Inject(GAUZY_ENV) readonly environment: Environment) {
		this.isSupportChatAvailable = !!environment.CHATWOOT_SDK_TOKEN;
		this.repoBaseUrl = (environment.PROJECT_REPO ?? 'https://github.com/ever-co/ever-gauzy.git').replace(/\.git$/, '');
	}

	/**
	 * Opens the Chatwoot support conversation — same contract as the Quick
	 * Settings entry: the launcher bubble is suppressed (`hideMessageBubble`),
	 * and "not loaded YET" differs from "not configured", so a click that lands
	 * before sdk.js finishes waits for `chatwoot:ready` instead of being
	 * silently swallowed.
	 */
	public openSupportChat(): void {
		const chatwoot = () => (window as unknown as { $chatwoot?: IChatwootWidget }).$chatwoot;
		const widget = chatwoot();

		if (widget) {
			widget.toggle('open');
			return;
		}
		if (!this.isSupportChatAvailable || this.pendingOpen) {
			return;
		}
		this.pendingOpen = () => {
			this.pendingOpen = null;
			chatwoot()?.toggle('open');
		};
		window.addEventListener('chatwoot:ready', this.pendingOpen, { once: true });
	}

	ngOnDestroy(): void {
		if (this.pendingOpen) {
			window.removeEventListener('chatwoot:ready', this.pendingOpen);
			this.pendingOpen = null;
		}
	}
}
