import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NbSidebarService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { asyncScheduler, merge } from 'rxjs';
import { filter, observeOn, take, tap } from 'rxjs/operators';
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
export class ThemeSettingsComponent implements OnInit, OnDestroy {
	private state: boolean;

	private clickedInOverlay = false;

	@HostListener('document:click', ['$event.target'])
	public trackOverlayClick(target: EventTarget | null): void {
		this.clickedInOverlay = target instanceof Element && !!target.closest('.cdk-overlay-container');
	}

	/**
	 * Support chat is only offered when this deployment configured a Chatwoot
	 * website token: AppComponent only injects the SDK in that case, so without
	 * a token there would be no widget to open.
	 */
	public readonly isSupportChatAvailable: boolean = !!environment.CHATWOOT_SDK_TOKEN;

	/**
	 * Destination for the FAQ entry.
	 *
	 * There is no in-app `faq` route — the entry carried neither a link nor a click
	 * handler in the header menu it came from, so it had always been dead. The only
	 * FAQ that actually exists is the published one on the docs site
	 * (`ever-gauzy-docs/website/docs/reference/faq.md`; that Docusaurus site is
	 * configured with `baseUrl: '/'` and `routeBasePath: '/'`, hence no `/docs`
	 * segment in the URL).
	 */
	public readonly faqUrl: string = 'https://docs.gauzy.co/reference/faq';

	constructor(
		private readonly sidebarService: NbSidebarService,
		private readonly router: Router
	) {}

	ngOnInit(): void {
		// This ran in ngAfterViewChecked — i.e. after every change-detection pass — opening a new
		// subscription each time. untilDestroyed only reclaims them when this component is destroyed,
		// and it lives for as long as the layout does, so they piled up. `getSidebarState()` is also
		// not a plain getter: each call allocates a ReplaySubject and pushes it onto a module-level
		// Subject that Nebular broadcasts to EVERY mounted sidebar, so the cost was app-wide per tick.
		//
		// It cannot simply move to a single subscription, though: getSidebarState() emits exactly ONCE
		// (it is a query, not a stream), and `state` has to stay current — onClickOutside() below uses
		// it to decide whether an outside click should close the panel, so a value frozen at init would
		// leave the panel un-closable. Re-read it when the sidebar actually changes instead.
		this.syncState();
		merge(
			this.sidebarService.onToggle(),
			this.sidebarService.onExpand(),
			this.sidebarService.onCollapse(),
			this.sidebarService.onCompact()
		)
			.pipe(
				// Tagged-only, matching how NbSidebarComponent itself filters: a sidebar that HAS a tag
				// ignores untagged events, so reacting to them here would just re-query for nothing.
				filter(({ tag }) => tag === QUICK_SETTINGS_SIDEBAR_TAG),
				// DO NOT make this synchronous. The header gear calls sidebarService.toggle() from a
				// click handler, and `OutsideDirective` listens on `document:click` WITHOUT capture, so
				// it runs later in that same dispatch. If `state` were already true by then,
				// onClickOutside() below would see "clicked outside && open" and immediately collapse
				// the panel the gear just opened — verified: the trace read
				//   toggle(settings_sidebar) -> state=true -> collapse(settings_sidebar) -> state=false
				// and the panel became impossible to open.
				//
				// The old ngAfterViewChecked version only worked BECAUSE its value was stale for that
				// tick, so "read the state on demand instead" reintroduces the same bug — by the time
				// the document click runs, the sidebar really is expanded. The panel must simply not
				// count as open during the click that opened it, so defer to a macro task. A microtask is
				// NOT enough: microtask checkpoints drain between individual DOM listeners.
				observeOn(asyncScheduler),
				untilDestroyed(this)
			)
			.subscribe(() => this.syncState());
	}

	/**
	 * Read the Quick Settings sidebar's current state.
	 *
	 * `take(1)` is what makes this safe to call repeatedly: getSidebarState() returns a ReplaySubject
	 * that receives exactly one value, so without it each call would leave a subscription open forever
	 * waiting for a second emission that never arrives.
	 */
	private syncState(): void {
		this.sidebarService
			.getSidebarState(QUICK_SETTINGS_SIDEBAR_TAG)
			.pipe(
				take(1),
				tap((state) => (this.state = state === 'expanded')),
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
		if (!event && !this.clickedInOverlay && this.state) this.closeSidebar();
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
		const chatwoot = () => (window as unknown as { $chatwoot?: IChatwootWidget }).$chatwoot;
		const widget = chatwoot();

		if (widget) {
			widget.toggle('open');
			this.closeSidebar();
			return;
		}

		// Not loaded YET is different from not configured. Without this branch a click
		// that lands before sdk.js finishes is silently swallowed — a dead click, and
		// the launcher bubble is hidden so this entry is the only way in. The SDK
		// dispatches `chatwoot:ready` once `$chatwoot` is usable; wait for it once.
		if (!this.isSupportChatAvailable) {
			return;
		}

		window.addEventListener('chatwoot:ready', () => chatwoot()?.toggle('open'), { once: true });
		this.closeSidebar();
	}
}
