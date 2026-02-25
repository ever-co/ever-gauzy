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
	SimpleChanges,
	ViewContainerRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

/**
 * Internal tracking for mounted extension components.
 */
interface MountedExtension {
	extension: PageExtensionDefinition;
	componentRef?: ComponentRef<unknown>;
	mounted: boolean;
}

/**
 * Renders all extensions registered for a given slot with reactive updates.
 *
 * Features:
 * - **Reactive**: Automatically updates when extensions are registered/unregistered
 * - **Lifecycle Hooks**: Calls onMount, onUnmount, onActivate, onDeactivate
 * - **Visibility Control**: Filters extensions based on permissions/features
 * - **Wrappers**: Supports built-in wrappers (card, widget, window, panel)
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
	imports: [CommonModule, NbCardModule],
	template: `
		@for (mounted of _mountedExtensions; track mounted.extension.id) {
			@if (mounted.mounted) {
				<div
					class="extension-container"
					[class]="extensionClass"
					[attr.data-extension-id]="mounted.extension.id"
					[attr.data-framework]="mounted.extension.frameworkId"
				>
					@switch (getWrapperType(mounted.extension)) {
						@case ('card') {
							<nb-card>
								@if (getWrapperConfig(mounted.extension)?.showHeader !== false) {
									<nb-card-header>
										{{ getWrapperConfig(mounted.extension)?.title || mounted.extension.metadata?.title || mounted.extension.id }}
									</nb-card-header>
								}
								<nb-card-body>
									@if (mounted.extension.component) {
										<ng-container *ngComponentOutlet="mounted.extension.component; inputs: $any(mounted.extension.config)" />
									}
								</nb-card-body>
							</nb-card>
						}
						@case ('widget') {
							<nb-card class="extension-widget">
								<nb-card-body>
									@if (mounted.extension.component) {
										<ng-container *ngComponentOutlet="mounted.extension.component; inputs: $any(mounted.extension.config)" />
									}
								</nb-card-body>
							</nb-card>
						}
						@case ('window') {
							<nb-card class="extension-window">
								@if (getWrapperConfig(mounted.extension)?.showHeader !== false) {
									<nb-card-header>
										{{ getWrapperConfig(mounted.extension)?.title || mounted.extension.metadata?.title || mounted.extension.id }}
									</nb-card-header>
								}
								<nb-card-body>
									@if (mounted.extension.component) {
										<ng-container *ngComponentOutlet="mounted.extension.component; inputs: $any(mounted.extension.config)" />
									}
								</nb-card-body>
							</nb-card>
						}
						@case ('panel') {
							<div class="extension-panel" [class]="getWrapperConfig(mounted.extension)?.cssClass">
								@if (getWrapperConfig(mounted.extension)?.showHeader !== false && getWrapperConfig(mounted.extension)?.title) {
									<div class="extension-panel-header">
										{{ getWrapperConfig(mounted.extension)?.title }}
									</div>
								}
								<div class="extension-panel-body">
									@if (mounted.extension.component) {
										<ng-container *ngComponentOutlet="mounted.extension.component; inputs: $any(mounted.extension.config)" />
									}
								</div>
							</div>
						}
						@default {
							@if (mounted.extension.component) {
								<ng-container *ngComponentOutlet="mounted.extension.component; inputs: $any(mounted.extension.config)" />
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
			this._unmountAll();
			this._subscribeToExtensions();
		}
		if (changes['visibilityContext'] && !changes['visibilityContext'].firstChange) {
			this._refreshVisibility();
		}
	}

	ngOnDestroy(): void {
		this._unmountAll();
	}

	/**
	 * Subscribes to extension changes for reactive updates.
	 */
	private _subscribeToExtensions(): void {
		if (!this.slotId) return;

		if (this.reactive) {
			// Reactive mode: Subscribe to extension changes
			this._extensionRegistry
				.getExtensions$(this.slotId)
				.pipe(takeUntilDestroyed(this._destroyRef))
				.subscribe((extensions) => {
					this._updateExtensions(extensions);
				});
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
		const toMount = visibleExtensions.filter(
			(e) => !this._mountedExtensions.find((m) => m.extension.id === e.id)
		);

		// Unmount removed extensions
		for (const mounted of toUnmount) {
			await this._unmountExtension(mounted);
		}

		// Remove unmounted from list
		this._mountedExtensions = this._mountedExtensions.filter(
			(m) => !toUnmount.includes(m)
		);

		// Mount new extensions
		for (const ext of toMount) {
			await this._mountExtension(ext);
		}

		// Sort by order
		this._mountedExtensions.sort(
			(a, b) => (a.extension.order ?? 999) - (b.extension.order ?? 999)
		);

		this._cdr.markForCheck();
	}

	/**
	 * Filters extensions based on visibility rules.
	 */
	private async _filterVisibleExtensions(
		extensions: PageExtensionDefinition[]
	): Promise<PageExtensionDefinition[]> {
		const context: ExtensionVisibilityContext = {
			injector: this._injector,
			user: this.visibilityContext?.user,
			organization: this.visibilityContext?.organization,
			data: { ...this.visibilityContext?.data, ...this.contextData }
		};

		const visible: PageExtensionDefinition[] = [];
		for (const ext of extensions) {
			if (await this._isVisible(ext, context)) {
				visible.push(ext);
			}
		}
		return visible;
	}

	/**
	 * Checks if an extension is visible.
	 */
	private async _isVisible(
		ext: PageExtensionDefinition,
		context: ExtensionVisibilityContext
	): Promise<boolean> {
		if (ext.hidden) return false;

		if (ext.visible) {
			const result = ext.visible(context);
			return result instanceof Promise ? await result : result;
		}

		// For permissions/features, delegate to registry
		// (simplified for component - full check in registry)
		return true;
	}

	/**
	 * Mounts an extension and calls onMount lifecycle hook.
	 */
	private async _mountExtension(extension: PageExtensionDefinition): Promise<void> {
		const mounted: MountedExtension = {
			extension,
			mounted: true
		};

		this._mountedExtensions.push(mounted);

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
		return extension.wrapper.type === 'custom' ? 'none' : extension.wrapper.type;
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
