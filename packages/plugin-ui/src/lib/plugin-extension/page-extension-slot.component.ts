import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ComponentRef,
	DestroyRef,
	ElementRef,
	inject,
	Injector,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	Type,
	SimpleChanges,
	ViewContainerRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concatMap, from, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NbCardModule } from '@nebular/theme';
import {
	PageExtensionDefinition,
	PageExtensionSlotId,
	ExtensionLifecycleContext,
	ExtensionVisibilityContext,
	ExtensionWrapperConfig,
	ExtensionWrapperType
} from './page-extension-slot.types';
import { PageExtensionRegistryService } from './page-extension-registry.service';
import { FrameworkHostComponent } from '../ui-bridge/framework-host.component';
import { isFrameworkExtension, FrameworkExtensionDefinition } from '../ui-bridge/framework-extension.helper';

/**
 * Internal tracking for mounted extension components.
 */
interface MountedExtension {
	extension: PageExtensionDefinition;
	componentRef?: ComponentRef<unknown>;
	/** Resolved component class (from eager `component` or lazy `loadComponent`). */
	resolvedComponent?: Type<unknown>;
	/** Whether the lazy component is still loading. */
	loading: boolean;
	mounted: boolean;
	/** Error message if lazy loading failed. */
	error?: string;
	/** Whether this extension is a framework (non-Angular) extension. */
	isFramework: boolean;
	/** Resolved framework component (from eager or lazy loading). */
	resolvedFrameworkComponent?: unknown;
	/** Lazy loader for framework component (from FrameworkExtensionDefinition). */
	loadFrameworkComponent?: () => Promise<unknown>;
}

/**
 * Renders all extensions registered for a given slot with reactive updates.
 *
 * Features:
 * - **Reactive**: Automatically updates when extensions are registered/unregistered
 * - **Lifecycle Hooks**: Calls onMount, onUnmount, onActivate, onDeactivate
 * - **Visibility Control**: Filters extensions based on permissions/features
 * - **Wrappers**: Supports built-in wrappers (card, widget, window, panel)
 * - **Multi-framework**: Auto-detects framework extensions and renders via `<gz-framework-host>`
 * - **Error/retry**: Shows error state with retry button on lazy load failure
 *
 * @example
 * ```html
 * <!-- Basic usage -->
 * <ga-page-extension-slot slotId="dashboard-widgets"></ga-page-extension-slot>
 *
 * <!-- With visibility context -->
 * <ga-page-extension-slot
 *   [slotId]="PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS"
 *   [visibilityContext]="{ user: currentUser, organization: org }"
 * ></ga-page-extension-slot>
 *
 * <!-- With wrapper override -->
 * <ga-page-extension-slot
 *   slotId="dashboard-widgets"
 *   defaultWrapper="card"
 * ></ga-page-extension-slot>
 * ```
 */
@Component({
	selector: 'ga-page-extension-slot',
	standalone: true,
	imports: [CommonModule, NbCardModule, FrameworkHostComponent],
	template: `
		@for (mounted of _mountedExtensions; track mounted.extension.id) {
			@if (mounted.mounted) {
				<div
					class="extension-container"
					[class]="extensionClass"
					[attr.data-extension-id]="mounted.extension.id"
					[attr.data-framework]="mounted.extension.frameworkId"
				>
					@if (mounted.loading) {
						<div class="extension-loading">Loading…</div>
					} @else if (mounted.error) {
						<div class="extension-error">
							<span>Failed to load "{{ mounted.extension.id }}"</span>
							<button (click)="retryExtension(mounted)">Retry</button>
						</div>
					} @else if (mounted.isFramework) {
						<!-- Framework extension: delegate to gz-framework-host -->
						@switch (getWrapperType(mounted.extension)) {
							@case ('card') {
								<nb-card>
									@if (getWrapperConfig(mounted.extension)?.showHeader !== false) {
										<nb-card-header>
											{{
												getWrapperConfig(mounted.extension)?.title ||
													mounted.extension.metadata?.title ||
													mounted.extension.id
											}}
										</nb-card-header>
									}
									<nb-card-body>
										<gz-framework-host
											[frameworkId]="mounted.extension.frameworkId!"
											[component]="mounted.resolvedFrameworkComponent"
											[loadComponent]="mounted.loadFrameworkComponent"
											[props]="$any(mounted.extension.config)?.props"
											[context]="$any(mounted.extension.config)?.context"
										/>
									</nb-card-body>
								</nb-card>
							}
							@case ('widget') {
								<nb-card class="extension-widget">
									<nb-card-body>
										<gz-framework-host
											[frameworkId]="mounted.extension.frameworkId!"
											[component]="mounted.resolvedFrameworkComponent"
											[loadComponent]="mounted.loadFrameworkComponent"
											[props]="$any(mounted.extension.config)?.props"
											[context]="$any(mounted.extension.config)?.context"
										/>
									</nb-card-body>
								</nb-card>
							}
							@case ('window') {
								<nb-card class="extension-window">
									@if (getWrapperConfig(mounted.extension)?.showHeader !== false) {
										<nb-card-header>
											{{
												getWrapperConfig(mounted.extension)?.title ||
													mounted.extension.metadata?.title ||
													mounted.extension.id
											}}
										</nb-card-header>
									}
									<nb-card-body>
										<gz-framework-host
											[frameworkId]="mounted.extension.frameworkId!"
											[component]="mounted.resolvedFrameworkComponent"
											[loadComponent]="mounted.loadFrameworkComponent"
											[props]="$any(mounted.extension.config)?.props"
											[context]="$any(mounted.extension.config)?.context"
										/>
									</nb-card-body>
								</nb-card>
							}
							@case ('panel') {
								<div class="extension-panel" [class]="getWrapperConfig(mounted.extension)?.cssClass">
									@if (
										getWrapperConfig(mounted.extension)?.showHeader !== false &&
										getWrapperConfig(mounted.extension)?.title
									) {
										<div class="extension-panel-header">
											{{ getWrapperConfig(mounted.extension)?.title }}
										</div>
									}
									<div class="extension-panel-body">
										<gz-framework-host
											[frameworkId]="mounted.extension.frameworkId!"
											[component]="mounted.resolvedFrameworkComponent"
											[loadComponent]="mounted.loadFrameworkComponent"
											[props]="$any(mounted.extension.config)?.props"
											[context]="$any(mounted.extension.config)?.context"
										/>
									</div>
								</div>
							}
							@default {
								<gz-framework-host
									[frameworkId]="mounted.extension.frameworkId!"
									[component]="mounted.resolvedFrameworkComponent"
									[loadComponent]="mounted.loadFrameworkComponent"
									[props]="$any(mounted.extension.config)?.props"
									[context]="$any(mounted.extension.config)?.context"
								/>
							}
						}
					} @else {
						<!-- Angular extension: use ngComponentOutlet -->
						@switch (getWrapperType(mounted.extension)) {
							@case ('card') {
								<nb-card>
									@if (getWrapperConfig(mounted.extension)?.showHeader !== false) {
										<nb-card-header>
											{{
												getWrapperConfig(mounted.extension)?.title ||
													mounted.extension.metadata?.title ||
													mounted.extension.id
											}}
										</nb-card-header>
									}
									<nb-card-body>
										@if (mounted.resolvedComponent) {
											<ng-container
												*ngComponentOutlet="
													mounted.resolvedComponent;
													inputs: $any(mounted.extension.config)
												"
											/>
										}
									</nb-card-body>
								</nb-card>
							}
							@case ('widget') {
								<nb-card class="extension-widget">
									<nb-card-body>
										@if (mounted.resolvedComponent) {
											<ng-container
												*ngComponentOutlet="
													mounted.resolvedComponent;
													inputs: $any(mounted.extension.config)
												"
											/>
										}
									</nb-card-body>
								</nb-card>
							}
							@case ('window') {
								<nb-card class="extension-window">
									@if (getWrapperConfig(mounted.extension)?.showHeader !== false) {
										<nb-card-header>
											{{
												getWrapperConfig(mounted.extension)?.title ||
													mounted.extension.metadata?.title ||
													mounted.extension.id
											}}
										</nb-card-header>
									}
									<nb-card-body>
										@if (mounted.resolvedComponent) {
											<ng-container
												*ngComponentOutlet="
													mounted.resolvedComponent;
													inputs: $any(mounted.extension.config)
												"
											/>
										}
									</nb-card-body>
								</nb-card>
							}
							@case ('panel') {
								<div class="extension-panel" [class]="getWrapperConfig(mounted.extension)?.cssClass">
									@if (
										getWrapperConfig(mounted.extension)?.showHeader !== false &&
										getWrapperConfig(mounted.extension)?.title
									) {
										<div class="extension-panel-header">
											{{ getWrapperConfig(mounted.extension)?.title }}
										</div>
									}
									<div class="extension-panel-body">
										@if (mounted.resolvedComponent) {
											<ng-container
												*ngComponentOutlet="
													mounted.resolvedComponent;
													inputs: $any(mounted.extension.config)
												"
											/>
										}
									</div>
								</div>
							}
							@case ('custom') {
								<div
									class="extension-custom-wrapper"
									[class]="getWrapperConfig(mounted.extension)?.cssClass"
								>
									@if (mounted.resolvedComponent) {
										<ng-container
											*ngComponentOutlet="
												mounted.resolvedComponent;
												inputs: $any(mounted.extension.config)
											"
										/>
									}
								</div>
							}
							@default {
								@if (mounted.resolvedComponent) {
									<ng-container
										*ngComponentOutlet="
											mounted.resolvedComponent;
											inputs: $any(mounted.extension.config)
										"
									/>
								}
							}
						}
					}
				</div>
			}
		}
	`,
	styles: [
		`
			:host {
				display: contents;
			}
			.extension-container {
				display: contents;
			}
			.extension-widget {
				margin-bottom: 1rem;
			}
			.extension-window {
				margin-bottom: 1.5rem;
			}
			.extension-panel {
				margin-bottom: 1rem;
			}
			.extension-panel-header {
				font-weight: 600;
				margin-bottom: 0.5rem;
				padding: 0.5rem;
				border-bottom: 1px solid var(--border-basic-color-3, #edf1f7);
			}
			.extension-panel-body {
				padding: 0.5rem;
			}
			.extension-loading {
				padding: 1rem;
				text-align: center;
				color: var(--text-hint-color, #8f9bb3);
				font-size: 0.875rem;
			}
			.extension-error {
				padding: 1rem;
				text-align: center;
				color: var(--color-danger-500, #ff3d71);
				font-size: 0.875rem;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
			}
			.extension-error button {
				padding: 0.25rem 0.75rem;
				border: 1px solid var(--color-danger-500, #ff3d71);
				border-radius: 4px;
				background: transparent;
				color: var(--color-danger-500, #ff3d71);
				cursor: pointer;
				font-size: 0.75rem;
			}
			.extension-error button:hover {
				background: var(--color-danger-500, #ff3d71);
				color: #fff;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageExtensionSlotComponent implements OnInit, OnChanges, OnDestroy {
	private readonly _extensionRegistry = inject(PageExtensionRegistryService);
	private readonly _injector = inject(Injector);
	private readonly _cdr = inject(ChangeDetectorRef);
	private readonly _destroyRef = inject(DestroyRef);
	private readonly _viewContainerRef = inject(ViewContainerRef);
	private readonly _elementRef = inject(ElementRef);

	/** Tracks pending async cleanup to serialize mount/unmount operations. */
	private _pendingCleanup: Promise<void> = Promise.resolve();

	/** Active extension subscription — cancelled before re-subscribing to avoid leaks. */
	private _extensionSub?: Subscription;

	/**
	 * The slot identifier to render extensions for.
	 * Use PAGE_EXTENSION_SLOTS constants for well-known slots.
	 */
	@Input({ required: true }) slotId!: PageExtensionSlotId;

	/**
	 * Optional CSS class to apply to each extension container.
	 */
	@Input() extensionClass?: string;

	/**
	 * Default wrapper for extensions that don't specify one.
	 */
	@Input() defaultWrapper?: ExtensionWrapperType;

	/**
	 * Context for visibility checks (user, organization, etc.).
	 */
	@Input() visibilityContext?: Partial<ExtensionVisibilityContext>;

	/**
	 * Additional data to pass to extensions via lifecycle context.
	 */
	@Input() contextData?: Record<string, unknown>;

	/**
	 * Whether to use reactive updates (default: true).
	 * Set to false for static extension loading.
	 */
	@Input() reactive = true;

	/**
	 * Mounted extensions with their component refs.
	 */
	_mountedExtensions: MountedExtension[] = [];

	ngOnInit(): void {
		this._subscribeToExtensions();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['slotId'] && !changes['slotId'].firstChange) {
			this._pendingCleanup = this._unmountAll().then(() => {
				this._subscribeToExtensions();
			});
		}
		if (changes['visibilityContext'] && !changes['visibilityContext'].firstChange) {
			this._pendingCleanup = this._pendingCleanup.then(() => this._refreshVisibility());
		}
	}

	ngOnDestroy(): void {
		this._unmountAll();
	}

	/**
	 * Retry loading a failed extension.
	 */
	async retryExtension(mounted: MountedExtension): Promise<void> {
		mounted.error = undefined;
		mounted.loading = true;
		this._cdr.markForCheck();

		// Re-attempt lazy loading
		if (mounted.isFramework) {
			// For framework extensions, the FrameworkHostComponent handles retry
			// Just clear the error and let it re-render
			mounted.loading = false;
			this._cdr.markForCheck();
		} else {
			await this._resolveLazyComponent(mounted);
		}
	}

	/**
	 * Subscribes to extension changes for reactive updates.
	 */
	private _subscribeToExtensions(): void {
		if (!this.slotId) return;

		// Cancel previous subscription to avoid leaks when slotId changes
		this._extensionSub?.unsubscribe();

		if (this.reactive) {
			// Reactive mode: Subscribe to extension changes
			this._extensionSub = this._extensionRegistry
				.getExtensions$(this.slotId)
				.pipe(
					concatMap((extensions) => from(this._updateExtensions(extensions))),
					takeUntilDestroyed(this._destroyRef)
				)
				.subscribe();
		} else {
			// Static mode: Load once
			const extensions = this._extensionRegistry.getExtensions(this.slotId);
			this._updateExtensions(extensions);
		}
	}

	/**
	 * Updates the mounted extensions based on the new list.
	 */
	private async _updateExtensions(extensions: PageExtensionDefinition[]): Promise<void> {
		// Filter visible extensions
		const visibleExtensions = await this._filterVisibleExtensions(extensions);

		// Find extensions to unmount (removed)
		const toUnmount = this._mountedExtensions.filter(
			(m) => !visibleExtensions.find((e) => e.id === m.extension.id)
		);

		// Find extensions to mount (new)
		const toMount = visibleExtensions.filter((e) => !this._mountedExtensions.find((m) => m.extension.id === e.id));

		// Unmount removed extensions
		for (const mounted of toUnmount) {
			await this._unmountExtension(mounted);
		}

		// Remove unmounted from list
		this._mountedExtensions = this._mountedExtensions.filter((m) => !toUnmount.includes(m));

		// Mount new extensions
		for (const ext of toMount) {
			await this._mountExtension(ext);
		}

		// Sort by order
		this._mountedExtensions.sort((a, b) => (a.extension.order ?? 999) - (b.extension.order ?? 999));

		this._cdr.markForCheck();
	}

	/**
	 * Filters extensions based on visibility rules.
	 * Delegates to the registry's full visibility check which handles
	 * permissions, permissionsAny, featureKey, hidden flag, and custom visible callbacks.
	 */
	private async _filterVisibleExtensions(_extensions: PageExtensionDefinition[]): Promise<PageExtensionDefinition[]> {
		const context: Partial<ExtensionVisibilityContext> = {
			user: this.visibilityContext?.user,
			organization: this.visibilityContext?.organization,
			data: { ...this.visibilityContext?.data, ...this.contextData }
		};

		return this._extensionRegistry.getVisibleExtensions(this.slotId, context);
	}

	/**
	 * Mounts an extension and calls onMount lifecycle hook.
	 * Detects framework extensions and sets up accordingly.
	 * If the extension uses `loadComponent`, resolves it lazily before rendering.
	 */
	private async _mountExtension(extension: PageExtensionDefinition): Promise<void> {
		const framework = isFrameworkExtension(extension);
		const hasLazyComponent = !framework && !!extension.loadComponent;

		// For framework extensions, extract the component and loader
		let resolvedFrameworkComponent: unknown | undefined;
		let loadFrameworkComponent: (() => Promise<unknown>) | undefined;

		if (framework) {
			const fwExt = extension as FrameworkExtensionDefinition;
			resolvedFrameworkComponent = fwExt.frameworkComponent;
			loadFrameworkComponent = fwExt.loadFrameworkComponent;
		}

		const mounted: MountedExtension = {
			extension,
			resolvedComponent: hasLazyComponent ? undefined : extension.component,
			loading: hasLazyComponent,
			mounted: true,
			isFramework: framework,
			resolvedFrameworkComponent,
			loadFrameworkComponent
		};

		this._mountedExtensions.push(mounted);

		// Resolve lazy Angular component
		if (hasLazyComponent && extension.loadComponent) {
			await this._resolveLazyComponent(mounted);
		}

		// Call onMount lifecycle hook
		if (extension.onMount) {
			const context = this._createLifecycleContext(extension);
			try {
				await extension.onMount(context);
			} catch (error) {
				console.error(`[ExtensionSlot] onMount error for '${extension.id}':`, error);
			}
		}
	}

	/**
	 * Resolves a lazy Angular component for a mounted extension.
	 * Sets error state on failure for retry support.
	 */
	private async _resolveLazyComponent(mounted: MountedExtension): Promise<void> {
		try {
			mounted.resolvedComponent = await mounted.extension.loadComponent!();
			mounted.loading = false;
			mounted.error = undefined;
			this._cdr.markForCheck();
		} catch (error: any) {
			const message = error?.message ?? String(error);
			console.error(`[ExtensionSlot] loadComponent failed for '${mounted.extension.id}':`, error);
			mounted.loading = false;
			mounted.error = message;
			this._cdr.markForCheck();
		}
	}

	/**
	 * Unmounts an extension and calls onUnmount lifecycle hook.
	 */
	private async _unmountExtension(mounted: MountedExtension): Promise<void> {
		mounted.mounted = false;

		// Call onUnmount lifecycle hook
		if (mounted.extension.onUnmount) {
			const context = this._createLifecycleContext(mounted.extension);
			try {
				await mounted.extension.onUnmount(context);
			} catch (error) {
				console.error(`[ExtensionSlot] onUnmount error for '${mounted.extension.id}':`, error);
			}
		}

		// Destroy component ref if exists
		if (mounted.componentRef) {
			mounted.componentRef.destroy();
			mounted.componentRef = undefined;
		}
	}

	/**
	 * Unmounts all extensions.
	 */
	private async _unmountAll(): Promise<void> {
		for (const mounted of this._mountedExtensions) {
			await this._unmountExtension(mounted);
		}
		this._mountedExtensions = [];
	}

	/**
	 * Refreshes visibility for all mounted extensions.
	 */
	private async _refreshVisibility(): Promise<void> {
		const extensions = this._extensionRegistry.getExtensions(this.slotId);
		await this._updateExtensions(extensions);
	}

	/**
	 * Creates a lifecycle context for an extension.
	 */
	private _createLifecycleContext(extension: PageExtensionDefinition): ExtensionLifecycleContext {
		return {
			injector: this._injector,
			extension,
			slotId: this.slotId,
			data: { ...this.visibilityContext?.data, ...this.contextData }
		};
	}

	/**
	 * Gets the wrapper type for an extension.
	 */
	getWrapperType(extension: PageExtensionDefinition): ExtensionWrapperType {
		if (!extension.wrapper) {
			return this.defaultWrapper ?? 'none';
		}
		if (typeof extension.wrapper === 'string') {
			return extension.wrapper;
		}
		if (extension.wrapper.type === 'custom') {
			if (extension.wrapper.component) {
				return 'custom';
			}
			console.warn(
				`[ExtensionSlot] Extension '${extension.id}' uses wrapper type 'custom' but no component was provided. Falling back to 'none'.`
			);
			return 'none';
		}
		return extension.wrapper.type;
	}

	/**
	 * Gets the wrapper config for an extension.
	 */
	getWrapperConfig(extension: PageExtensionDefinition): ExtensionWrapperConfig | undefined {
		if (!extension.wrapper || typeof extension.wrapper === 'string') {
			return undefined;
		}
		return extension.wrapper;
	}

	/**
	 * Activates an extension (calls onActivate hook).
	 * Call this when a tab is selected, for example.
	 */
	async activateExtension(extensionId: string): Promise<void> {
		const mounted = this._mountedExtensions.find((m) => m.extension.id === extensionId);
		if (mounted?.extension.onActivate) {
			const context = this._createLifecycleContext(mounted.extension);
			await mounted.extension.onActivate(context);
		}
	}

	/**
	 * Deactivates an extension (calls onDeactivate hook).
	 */
	async deactivateExtension(extensionId: string): Promise<void> {
		const mounted = this._mountedExtensions.find((m) => m.extension.id === extensionId);
		if (mounted?.extension.onDeactivate) {
			const context = this._createLifecycleContext(mounted.extension);
			await mounted.extension.onDeactivate(context);
		}
	}
}
