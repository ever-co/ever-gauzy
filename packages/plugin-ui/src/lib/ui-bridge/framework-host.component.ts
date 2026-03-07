import {
	Component,
	Input,
	ElementRef,
	ViewChild,
	OnInit,
	OnDestroy,
	OnChanges,
	SimpleChanges,
	inject,
	Injector,
	ChangeDetectionStrategy,
	ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiBridgeRegistryService } from './ui-bridge-registry.service';
import { UiBridgeMountResult, UiBridgeFramework } from './ui-bridge.interface';

/**
 * Generic host component for rendering non-Angular framework components.
 *
 * This component acts as a bridge between Angular and other UI frameworks
 * (React, Vue, Svelte, etc.) by delegating mounting/unmounting to the
 * appropriate registered bridge.
 *
 * Supports:
 * - **Lazy bridges**: Async resolution via `UiBridgeRegistryService.getAsync()`
 * - **Lazy components**: `loadFrameworkComponent` for code-splitting
 * - **Error/retry**: Shows an error state with a retry button on load failure
 *
 * @example
 * ```html
 * <gz-framework-host
 *   frameworkId="react"
 *   [component]="MyReactComponent"
 *   [props]="{ title: 'Hello!' }"
 * />
 *
 * <!-- Lazy component -->
 * <gz-framework-host
 *   frameworkId="react"
 *   [loadComponent]="loadMyReactComponent"
 *   [props]="{ title: 'Lazy!' }"
 * />
 * ```
 */
@Component({
	selector: 'gz-framework-host',
	standalone: true,
	imports: [CommonModule],
	template: `
		@if (_loading) {
			<div class="framework-host-loading">Loading…</div>
		} @else if (_error) {
			<div class="framework-host-error">
				<span>{{ _error }}</span>
				<button (click)="retry()">Retry</button>
			</div>
		}
		<div #host class="framework-host"></div>
	`,
	styles: [
		`
			:host {
				display: contents;
			}
			.framework-host {
				display: contents;
			}
			.framework-host-loading {
				padding: 1rem;
				text-align: center;
				color: var(--text-hint-color, #8f9bb3);
				font-size: 0.875rem;
			}
			.framework-host-error {
				padding: 1rem;
				text-align: center;
				color: var(--color-danger-500, #ff3d71);
				font-size: 0.875rem;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
			}
			.framework-host-error button {
				padding: 0.25rem 0.75rem;
				border: 1px solid var(--color-danger-500, #ff3d71);
				border-radius: 4px;
				background: transparent;
				color: var(--color-danger-500, #ff3d71);
				cursor: pointer;
				font-size: 0.75rem;
			}
			.framework-host-error button:hover {
				background: var(--color-danger-500, #ff3d71);
				color: #fff;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrameworkHostComponent implements OnInit, OnDestroy, OnChanges {
	/**
	 * Framework identifier (e.g., 'react', 'vue', 'svelte').
	 * Must match a registered bridge in UiBridgeRegistryService.
	 */
	@Input({ required: true }) frameworkId!: UiBridgeFramework;

	/**
	 * The framework component to render (eager).
	 */
	@Input() component?: unknown;

	/**
	 * Lazy-load the framework component for code-splitting.
	 * Mutually exclusive with `component` — if both set, `loadComponent` takes precedence.
	 */
	@Input() loadComponent?: () => Promise<unknown>;

	/**
	 * Props to pass to the framework component.
	 */
	@Input() props?: unknown;

	/**
	 * Additional context to provide to the component.
	 */
	@Input() context?: unknown;

	@ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLElement>;

	private readonly _bridgeRegistry = inject(UiBridgeRegistryService);
	private readonly _injector = inject(Injector);
	private readonly _cdr = inject(ChangeDetectorRef);
	private _mountResult?: UiBridgeMountResult;

	/** Whether the component/bridge is currently loading. */
	_loading = false;

	/** Error message if loading failed. */
	_error: string | null = null;

	ngOnInit(): void {
		this._mount();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['props'] && !changes['props'].firstChange) {
			if (this._mountResult?.updateProps) {
				this._mountResult.updateProps(this.props);
				return;
			}
		}

		if (changes['component'] || changes['loadComponent'] || changes['frameworkId']) {
			this._unmount();
			this._mount();
		}
	}

	ngOnDestroy(): void {
		this._unmount();
	}

	/**
	 * Retry mounting after a failure.
	 */
	retry(): void {
		this._error = null;
		this._unmount();
		this._mount();
	}

	private async _mount(): Promise<void> {
		if (!this.frameworkId || (!this.component && !this.loadComponent)) {
			return;
		}

		this._loading = true;
		this._error = null;
		this._cdr.markForCheck();

		try {
			// Resolve bridge (async — supports lazy bridges)
			const bridge = await this._bridgeRegistry.getAsync(this.frameworkId);
			if (!bridge) {
				const available = this._bridgeRegistry.getRegisteredFrameworks();
				const availableStr = available.length > 0 ? available.join(', ') : 'none';
				this._error =
					`Bridge '${this.frameworkId}' not registered. ` +
					`Available: ${availableStr}. ` +
					`Make sure to import and provide the bridge.`;
				this._loading = false;
				this._cdr.markForCheck();
				return;
			}

			// Resolve component (lazy if loadComponent is provided)
			let resolvedComponent = this.component;
			if (this.loadComponent) {
				resolvedComponent = await this.loadComponent();
			}

			if (!resolvedComponent) {
				this._error = `No component resolved for framework '${this.frameworkId}'.`;
				this._loading = false;
				this._cdr.markForCheck();
				return;
			}

			this._mountResult = bridge.mount({
				component: resolvedComponent,
				props: this.props,
				context: this.context,
				hostElement: this.hostRef.nativeElement,
				injector: this._injector
			});

			this._loading = false;
			this._cdr.markForCheck();
		} catch (error: any) {
			const message = error?.message ?? String(error);
			console.error(`[FrameworkHost] Failed to mount ${this.frameworkId} component:`, error);
			this._error = `Failed to load: ${message}`;
			this._loading = false;
			this._cdr.markForCheck();
		}
	}

	private _unmount(): void {
		if (this._mountResult) {
			try {
				this._mountResult.unmount();
			} catch (error) {
				console.error(`[FrameworkHost] Failed to unmount ${this.frameworkId} component:`, error);
			}
			this._mountResult = undefined;
		}
	}
}
