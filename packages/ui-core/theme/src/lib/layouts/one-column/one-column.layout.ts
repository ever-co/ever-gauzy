import { Component, effect, inject, viewChild, afterNextRender, DestroyRef, signal, Type } from '@angular/core';
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

		// No ResizeObserver mirroring the chat width any more: the panel takes its width straight from
		// `--gz-chat-width` (the persisted user width), so there is a single source of truth and
		// nothing that can go stale. See one-column.layout.scss.

		// Runs only in the browser, after the first render — replaces ngAfterViewInit + isPlatformBrowser
		afterNextRender(() => {
			this.windowModeBlockScrollService.register(this.layout());
			this.observeHeaderHeight();
		});

		this.destroyRef.onDestroy(() => {
			this.navigationBuilderService.clearSidebars();
			this.navigationBuilderService.clearActionBars();
			this.headerResizeObserver?.disconnect();
		});
	}

	/**
	 * Horizontal inset the header needs so it starts where the CANVAS starts.
	 *
	 * The layout is three full-height columns — Menu | Chat | Canvas — and the header belongs to the
	 * canvas alone, so it must not run across the chat. Nebular renders a `fixed` header at full
	 * viewport width, so the inset is applied as padding on the side the chat is docked to.
	 *
	 * Null when there is nothing to inset around: collapsed, docked to the other side, or maximized
	 * (maximized deliberately covers the header band, since the canvas is hidden anyway).
	 */
	chatHeaderPad(side: 'start' | 'end'): number | null {
		const chat = this.chatSidebarService;
		return chat.available() && chat.expanded() && !chat.maximized() && chat.position() === side
			? chat.width()
			: null;
	}

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
	 * The principle: measure the box the browser actually produced, rather than restating a
	 * constant that the layout is free to exceed.
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
