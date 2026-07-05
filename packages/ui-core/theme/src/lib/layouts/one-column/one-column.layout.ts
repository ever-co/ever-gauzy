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

	private readonly elementRef = inject(ElementRef<HTMLElement>);
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
			Promise.resolve(config.loadComponent()).then((component) => {
				// Ignore the result if the sidebar was unregistered while loading.
				if (this.chatSidebarService.config() === config) {
					this.chatSidebarComponent.set(component);
				}
			});
		});

		Object.entries(DEFAULT_SIDEBARS).forEach(([id, config]) => {
			this.navigationBuilderService.registerSidebar(id, config);
			this.navigationBuilderService.addSidebarActionItem(config.actionItem);
		});
		this.navigationBuilderService.getSidebarWidgets();

		this.themeLanguageSelectorService.initialize();

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

	private headerResizeObserver?: ResizeObserver;

	/**
	 * Tracks the REAL rendered header height (the theme's `--header-height`
	 * variable does not include extras like the demo banner) and exposes it
	 * as `--gz-header-offset` for the chat sidebar's fixed container.
	 */
	private observeHeaderHeight(): void {
		const host = this.elementRef.nativeElement as HTMLElement;
		const header = host.querySelector('nb-layout-header');
		if (!header || typeof ResizeObserver === 'undefined') return;
		const apply = () => host.style.setProperty('--gz-header-offset', `${header.getBoundingClientRect().height}px`);
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
