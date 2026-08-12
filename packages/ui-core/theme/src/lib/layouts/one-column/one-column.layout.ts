import {
	Component,
	effect,
	inject,
	viewChild,
	afterNextRender,
	DestroyRef,
	signal,
	Type
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NbLayoutComponent, NbLayoutDirectionService, NbSidebarService } from '@nebular/theme';
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
	private readonly directionService = inject(NbLayoutDirectionService);

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
			this.observeHeaderBand();
		});

		this.destroyRef.onDestroy(() => {
			this.navigationBuilderService.clearSidebars();
			this.navigationBuilderService.clearActionBars();
			this.headerResizeObserver?.disconnect();
			this.bandResizeObserver?.disconnect();
			this.menuClassObserver?.disconnect();
			if (this.bandOnResize) window.removeEventListener('resize', this.bandOnResize);
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

	private bandResizeObserver?: ResizeObserver;

	/**
	 * Publish where the fixed HEADER BAND begins and ends, as `--gz-band-left` /
	 * `--gz-band-right`: from the nav menu sidebar's trailing edge to the layout's far edge. The
	 * band runs OVER the chat column (the chat sits below it at z 1039, its top at
	 * `--gz-header-height`), so unlike the old `--gz-canvas-left/right` — which measured
	 * `nb-layout-column`, i.e. the edge AFTER menu + chat — the band depends only on the menu
	 * sidebar's geometry. That is the point: the header chasing the chat's edge at 60Hz is where
	 * the whole staleness-bug class came from (see 536fa7fced), and a band that ignores chat state
	 * has nothing to go stale against.
	 *
	 * MEASURED, not derived from Nebular's width tokens: collapse, compaction and window-mode
	 * centring all move the real edges, and the derivation going wrong is what killed the previous
	 * design. Measuring the layout container (rather than assuming 0/viewport edges) keeps the
	 * >1920px centred window mode correct for free. The menu block is every in-flow sidebar on the
	 * leading side — `menu-sidebar` today, `user-workspace` if a layout ever renders it (none does
	 * currently) — attributed to left or right by which container edge it hugs, so RTL (menu at the
	 * trailing edge) falls out of the same arithmetic.
	 */
	private observeHeaderBand(): void {
		if (typeof ResizeObserver === 'undefined' || typeof document === 'undefined') return;
		const apply = () => {
			// Queried FRESH on every call — a captured node can go stale across layout re-renders,
			// and a stale node measures its old box while looking perfectly alive.
			const container = document.querySelector('nb-layout .layout .layout-container') as HTMLElement | null;
			if (!container) return;
			const containerRect = container.getBoundingClientRect();
			let left = containerRect.left;
			let right = window.innerWidth - containerRect.right;
			const blocks = Array.from(
				document.querySelectorAll('nb-sidebar.menu-sidebar, nb-sidebar.user-workspace')
			) as HTMLElement[];
			for (const block of blocks) {
				const rect = block.getBoundingClientRect();
				if (rect.width <= 0) continue; // collapsed → width 0, contributes nothing
				// Nearer the container's leading edge → it insets the band's left; RTL puts the
				// menu at the trailing edge, where it insets the band's right instead.
				const onLeft = rect.left - containerRect.left <= containerRect.right - rect.right;
				if (onLeft) left = Math.max(left, rect.right);
				else right = Math.max(right, window.innerWidth - rect.left);
			}
			const root = document.documentElement.style;
			root.setProperty('--gz-band-left', `${Math.round(left)}px`);
			root.setProperty('--gz-band-right', `${Math.round(right)}px`);
		};
		// The menu sidebar animates its collapse/compaction, so a single measurement lands
		// mid-animation and freezes the header at a stale inset. Settle over the transition:
		// idempotent style writes make the extra ticks free.
		const applySettled = () => {
			requestAnimationFrame(apply);
			setTimeout(apply, 120);
			setTimeout(apply, 400);
		};

		const menuHost = document.querySelector('nb-sidebar.menu-sidebar') as HTMLElement | null;
		if (menuHost) {
			this.bandResizeObserver = new ResizeObserver(apply);
			this.bandResizeObserver.observe(menuHost);
		}
		// The menu's own box does not change when the window does, so track that too.
		window.addEventListener('resize', apply);
		this.bandOnResize = apply;

		// A ResizeObserver fires on SIZE, and Nebular's expand/compact/collapse are stamped onto
		// the sidebar host as CLASSES — a MutationObserver on that attribute fires on every state
		// change no matter which observer mechanism is having a bad day. (Same belt-and-braces
		// pattern 536fa7fced added for the chat host, re-aimed at the menu.)
		if (menuHost && typeof MutationObserver !== 'undefined') {
			this.menuClassObserver = new MutationObserver(applySettled);
			this.menuClassObserver.observe(menuHost, { attributes: true, attributeFilter: ['class'] });
		}
		// An RTL flip moves the menu to the other edge WITHOUT resizing it, so neither observer
		// above fires — watch the direction change directly.
		this.directionService
			.onDirectionChange()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => applySettled());
		apply();
	}

	private menuClassObserver?: MutationObserver;

	private bandOnResize?: () => void;

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
