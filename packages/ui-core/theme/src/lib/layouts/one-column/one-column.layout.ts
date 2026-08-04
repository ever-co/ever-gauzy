import { Component, ElementRef, effect, inject, viewChild, afterNextRender, DestroyRef, signal, Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NbLayoutComponent, NbSidebarService } from '@nebular/theme';
import { ChatSidebarService, LayoutService, NavigationBuilderService, Store } from '@gauzy/ui-core/core';
import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { DEFAULT_SIDEBARS } from '../../components/theme-sidebar/default-sidebars';
import { ThemeLanguageSelectorService } from '../../components/theme-sidebar/theme-settings/components/theme-language-selector/theme-language-selector.service';

@Component({
	selector: 'ngx-one-column-layout',
	styleUrl: './one-column.layout.scss',
	templateUrl: './one-column.layout.html',
	standalone: false
})
export class OneColumnLayoutComponent {
	readonly isOpen = signal(false);
	readonly isWorkspaceOpen = signal(false);
	readonly isExpanded = signal(true);
	readonly isCollapse = signal(true);
	readonly trigger = signal(true);

	readonly layout = viewChild.required(NbLayoutComponent);

	private readonly windowModeBlockScrollService = inject(WindowModeBlockScrollService);
	private readonly store = inject(Store);
	public readonly navigationBuilderService = inject(NavigationBuilderService);
	public readonly chatSidebarService = inject(ChatSidebarService);
	private readonly sidebarService = inject(NbSidebarService);
	private readonly layoutService = inject(LayoutService);
	private readonly themeLanguageSelectorService = inject(ThemeLanguageSelectorService);
	private readonly destroyRef = inject(DestroyRef);

	/** User signal for template — derived from store observable. */
	readonly user = toSignal(this.store.user$);

	/** User observable — kept for child component compatibility (gauzy-user, gauzy-user-menu). */
	readonly user$ = this.store.user$;

	/**
	 * Resolved chat sidebar component for `ngComponentOutlet`.
	 * `IChatSidebarConfig.loadComponent` may be async (lazy chunk), so the
	 * factory result is resolved into this signal.
	 */
	readonly chatSidebarComponent = signal<Type<any> | null>(null);

	constructor() {
		// Resolve the (possibly lazy) chat sidebar component whenever a plugin registers one.
		effect(() => {
			const config = this.chatSidebarService.config();
			if (!config) {
				this.chatSidebarComponent.set(null);
				return;
			}
			Promise.resolve(config.loadComponent())
				.then((component) => {
					// Ignore the result if the sidebar was unregistered while loading.
					if (this.chatSidebarService.config() === config) {
						this.chatSidebarComponent.set(component);
					}
				})
				.catch((error: unknown) => {
					console.error('[OneColumnLayout] Failed to load the chat sidebar component:', error);
					if (this.chatSidebarService.config() === config) {
						this.chatSidebarComponent.set(null);
					}
				});
		});

		Object.entries(DEFAULT_SIDEBARS).forEach(([id, config]) => {
			this.navigationBuilderService.registerSidebar(id, config);
			this.navigationBuilderService.addSidebarActionItem(config.actionItem);
		});
		this.navigationBuilderService.getSidebarWidgets();

		this.themeLanguageSelectorService.initialize();

		// Track the chat sidebar HOST width (flex-computed: normal, maximized
		// or collapsed) and mirror it to --gz-chat-live-width so the fixed
		// .main-container always matches the space the host reserves.
		effect(() => {
			const hostRef = this.chatSidebarHost();
			this.chatHostResizeObserver?.disconnect();
			this.chatHostResizeObserver = undefined;
			if (!hostRef || typeof ResizeObserver === 'undefined') return;
			const host = hostRef.nativeElement as HTMLElement;
			const apply = () => host.style.setProperty('--gz-chat-live-width', `${host.getBoundingClientRect().width}px`);
			this.chatHostResizeObserver = new ResizeObserver(apply);
			this.chatHostResizeObserver.observe(host);
			apply();
		});

		// Runs only in the browser, after the first render — replaces ngAfterViewInit + isPlatformBrowser
		afterNextRender(() => {
			this.windowModeBlockScrollService.register(this.layout());
			this.observeHeaderHeight();
		});

		this.destroyRef.onDestroy(() => {
			this.navigationBuilderService.clearSidebars();
			this.navigationBuilderService.clearActionBars();
			this.chatHostResizeObserver?.disconnect();
			this.headerResizeObserver?.disconnect();
		});
	}

	/** The chat sidebar host element (present only while the chat renders). */
	readonly chatSidebarHost = viewChild<ElementRef<HTMLElement>>('chatSidebarHost');

	/**
	 * Horizontal padding the fixed header needs on the given side so its
	 * content moves aside for the expanded chat column instead of being
	 * covered by it. Null when the chat is collapsed, docked to the other
	 * side, or maximized (maximized covers the header band entirely).
	 */
	chatHeaderPad(side: 'start' | 'end'): number | null {
		const chat = this.chatSidebarService;
		return chat.available() && chat.expanded() && !chat.maximized() && chat.position() === side
			? chat.width()
			: null;
	}

	private chatHostResizeObserver?: ResizeObserver;
	private headerResizeObserver?: ResizeObserver;

	/**
	 * Publish the header's REAL rendered height as `--gz-header-height`.
	 *
	 * Nebular's `--header-height` is a theme CONSTANT (4.5rem = 72px). The header
	 * is content-driven, so it does not always agree: measured at 1600x950 it
	 * renders 98px, and anything anchored to the constant then sits ~26px too
	 * high and tucks under the real header. That is what put the Quick Settings
	 * panel behind the header — it is not visible at 4.5rem-tall headers, which
	 * is why it survived review.
	 *
	 * Mirrors the `--gz-chat-live-width` observer above: measure the box the
	 * browser actually produced, rather than restating a constant that the layout
	 * is free to exceed.
	 */
	private observeHeaderHeight(): void {
		if (typeof ResizeObserver === 'undefined' || typeof document === 'undefined') return;
		const header = document.querySelector('nb-layout-header') as HTMLElement | null;
		if (!header) return;
		const apply = () =>
			document.documentElement.style.setProperty(
				'--gz-header-height',
				`${Math.round(header.getBoundingClientRect().height)}px`
			);
		this.headerResizeObserver = new ResizeObserver(apply);
		this.headerResizeObserver.observe(header);
		apply();
	}

	/**
	 * Toggles the expansion state of the sidebar.
	 */
	toggle(): void {
		this.isExpanded.update((v) => !v);
		if (this.isExpanded()) {
			this.sidebarService.expand('menu-sidebar');
		} else {
			this.trigger.set(true);
			this.sidebarService.toggle(true, 'menu-sidebar');
			this.layoutService.changeLayoutSize();
		}
	}

	/**
	 * Handles the sidebar collapse event. Auto-expands if both collapsed and compacted.
	 */
	onCollapse(event: boolean): void {
		this.isCollapse.set(event);
		if (!this.isCollapse() && !this.isExpanded()) this.toggle();
	}

	/**
	 * Syncs expansion and trigger signals with the sidebar state change.
	 */
	onStateChange(event: string): void {
		this.isExpanded.set(event === 'expanded');
		this.trigger.set(event === 'compacted');
	}

	/**
	 * Toggles the workspace menu visibility.
	 */
	onWorkspaceToggle(isOpen: boolean): void {
		this.isWorkspaceOpen.set(isOpen);
	}

	/**
	 * Toggles the user menu overlay.
	 */
	toggleUserMenu(): void {
		this.isOpen.update((v) => !v);
	}

	/**
	 * Closes the user menu overlay.
	 */
	closeUserMenu(): void {
		this.isOpen.set(false);
	}

	/**
	 * Closes the workspace menu overlay.
	 */
	closeWorkspaceMenu(): void {
		this.isWorkspaceOpen.set(false);
	}
}
