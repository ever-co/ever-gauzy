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
			this.observeCanvasLeft();
		});

		this.destroyRef.onDestroy(() => {
			this.navigationBuilderService.clearSidebars();
			this.navigationBuilderService.clearActionBars();
			this.headerResizeObserver?.disconnect();
			this.canvasResizeObserver?.disconnect();
			if (this.canvasLeftOnResize) window.removeEventListener('resize', this.canvasLeftOnResize);
		});
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

	private canvasResizeObserver?: ResizeObserver;

	/**
	 * Publish where the CANVAS starts, as `--gz-canvas-left`, so the fixed header band can begin
	 * there instead of running underneath the columns in front of it.
	 *
	 * The header used to be full width and merely PAD its content aside by the chat's width. That
	 * arithmetic was wrong, and measurably so: on demo at 1280px the nav sidebar occupies 0-256 and
	 * the chat 256-640, so the canvas starts at 640 — but the padding was the chat's width alone,
	 * 384, leaving 256px of header content (the demo banner, the first filter) underneath a panel
	 * whose z-index is one higher. The banner rendered with its first words clipped.
	 *
	 * Padding is the wrong lever regardless of the number: it only moves what is INSIDE the header,
	 * so anything that escapes that box, or any future element added outside it, is behind the chat
	 * again. Insetting the band means nothing in the header can overlap the chat by construction.
	 *
	 * MEASURED off the layout column rather than computed from sidebar + chat widths, because those
	 * are Nebular's numbers and change with collapse, compaction and the user's own chat width — the
	 * derivation is exactly what went wrong. The column is in normal flow after both sidebars, so its
	 * left edge IS the canvas. Observing it is safe: the header is fixed and out of flow, so moving
	 * it cannot feed back into the column's geometry.
	 */
	private observeCanvasLeft(): void {
		if (typeof ResizeObserver === 'undefined' || typeof document === 'undefined') return;
		const column = document.querySelector('nb-layout-column') as HTMLElement | null;
		if (!column) return;
		const apply = () =>
			document.documentElement.style.setProperty(
				'--gz-canvas-left',
				`${Math.round(column.getBoundingClientRect().left)}px`
			);
		this.canvasResizeObserver = new ResizeObserver(apply);
		this.canvasResizeObserver.observe(column);
		// The column's own box does not change when the window does, so track that too.
		window.addEventListener('resize', apply);
		this.canvasLeftOnResize = apply;
		apply();
	}

	private canvasLeftOnResize?: () => void;

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
