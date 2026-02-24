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
	ChangeDetectionStrategy
} from '@angular/core';
import { UiBridgeRegistryService } from './ui-bridge-registry.service';
import { UiBridgeMountResult, UiBridgeFramework } from './ui-bridge.interface';

/**
 * Generic host component for rendering non-Angular framework components.
 *
 * This component acts as a bridge between Angular and other UI frameworks
 * (React, Vue, Svelte, etc.) by delegating mounting/unmounting to the
 * appropriate registered bridge.
 *
 * @example
 * ```html
 * <gz-framework-host
 *   frameworkId="react"
 *   [component]="MyReactComponent"
 *   [props]="{ title: 'Hello!' }"
 * />
 * ```
 */
@Component({
	selector: 'gz-framework-host',
	standalone: true,
	template: '<div #host class="framework-host"></div>',
	styles: [
		`
			:host {
				display: contents;
			}
			.framework-host {
				display: contents;
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
	 * The framework component to render.
	 */
	@Input({ required: true }) component!: unknown;

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
	private _mountResult?: UiBridgeMountResult;

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

		if (changes['component'] || changes['frameworkId']) {
			this._unmount();
			this._mount();
		}
	}

	ngOnDestroy(): void {
		this._unmount();
	}

	private _mount(): void {
		if (!this.frameworkId || !this.component) {
			return;
		}

		const bridge = this._bridgeRegistry.get(this.frameworkId);
		if (!bridge) {
			const available = this._bridgeRegistry.getRegisteredFrameworks();
			const availableStr = available.length > 0 ? available.join(', ') : 'none';
			console.warn(
				`[FrameworkHost] Bridge '${this.frameworkId}' not registered. ` +
					`Available bridges: ${availableStr}. ` +
					`Make sure to import and provide the bridge (e.g., provideReactBridge()).`
			);
			return;
		}

		try {
			this._mountResult = bridge.mount({
				component: this.component,
				props: this.props,
				context: this.context,
				hostElement: this.hostRef.nativeElement,
				injector: this._injector
			});
		} catch (error) {
			console.error(`[FrameworkHost] Failed to mount ${this.frameworkId} component:`, error);
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
