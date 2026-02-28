import {
	ChangeDetectorRef,
	Component,
	Input,
	Type,
	inject,
	Injector,
	ElementRef,
	OnInit,
	OnDestroy,
	OnChanges,
	SimpleChanges,
	ViewChild
} from '@angular/core';
import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { NgContextProvider } from './ng-react-context';

/**
 * Lifecycle context for React extensions.
 */
export interface ReactExtensionLifecycleContext {
	injector: Injector;
	extension: ReactExtensionDefinition;
	slotId: string;
	data?: Record<string, unknown>;
}

/**
 * Visibility context for React extensions.
 */
export interface ReactExtensionVisibilityContext {
	injector: Injector;
	user?: unknown;
	organization?: unknown;
	data?: Record<string, unknown>;
}

/**
 * Wrapper configuration for React extensions.
 */
export type ReactExtensionWrapper =
	| 'none'
	| 'card'
	| 'widget'
	| 'window'
	| 'panel'
	| {
			type: 'none' | 'card' | 'widget' | 'window' | 'panel' | 'custom';
			title?: string;
			cssClass?: string;
			showHeader?: boolean;
	  };

/**
 * Configuration for defining a React extension.
 */
export interface ReactExtensionConfig<TProps = Record<string, unknown>> {
	/** Unique id for this extension */
	id: string;
	/** Slot this extension contributes to */
	slotId: string;
	/** The React component to render */
	component: React.ComponentType<TProps>;
	/** Props to pass to the React component */
	props?: TProps | (() => TProps);
	/** Additional context for the component */
	context?: Record<string, unknown>;
	/** Optional order hint (lower = earlier) */
	order?: number;

	// ─── Visibility Control ─────────────────────────────────────────
	/** Required permissions (all must match) */
	permissions?: string[];
	/** Required permissions (any must match) */
	permissionsAny?: string[];
	/** Feature flag key */
	featureKey?: string;
	/** Custom visibility function */
	visible?: (context: ReactExtensionVisibilityContext) => boolean | Promise<boolean>;
	/** Hide the extension */
	hidden?: boolean;

	// ─── Wrapper ────────────────────────────────────────────────────
	/** Wrapper for consistent styling */
	wrapper?: ReactExtensionWrapper;

	// ─── Lifecycle Hooks ────────────────────────────────────────────
	/** Called when the extension is mounted */
	onMount?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;
	/** Called when the extension is unmounted */
	onUnmount?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;
	/** Called when the extension becomes active */
	onActivate?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;
	/** Called when the extension becomes inactive */
	onDeactivate?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;

	// ─── Metadata ───────────────────────────────────────────────────
	/** Extension metadata */
	metadata?: {
		title?: string;
		description?: string;
		icon?: string;
		category?: string;
		tags?: string[];
	};
}

/**
 * React extension definition that can be used in plugin definitions.
 */
export interface ReactExtensionDefinition<TProps = Record<string, unknown>> {
	id: string;
	slotId: string;
	component: Type<unknown>; // Angular component class
	config?: { props?: TProps; context?: Record<string, unknown> };
	order?: number;
	frameworkId: 'react';

	// Visibility
	permissions?: string[];
	permissionsAny?: string[];
	featureKey?: string;
	visible?: (context: ReactExtensionVisibilityContext) => boolean | Promise<boolean>;
	hidden?: boolean;

	// Wrapper
	wrapper?: ReactExtensionWrapper;

	// Lifecycle
	onMount?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;
	onUnmount?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;
	onActivate?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;
	onDeactivate?: (context: ReactExtensionLifecycleContext) => void | Promise<void>;

	// Metadata
	metadata?: {
		title?: string;
		description?: string;
		icon?: string;
		category?: string;
		tags?: string[];
	};

	/** Original React component (for reference) */
	reactComponent: React.ComponentType<TProps>;
	/** Props for the React component */
	reactProps?: TProps | (() => TProps);
	/** Context for the React component */
	reactContext?: Record<string, unknown>;
}

/**
 * Creates a dynamic Angular component class that wraps a React component.
 * This is used internally by defineReactExtension.
 */
function createReactWrapperComponent<TProps>(
	reactComponent: React.ComponentType<TProps>,
	defaultProps?: TProps | (() => TProps),
	defaultContext?: Record<string, unknown>
): Type<unknown> {
	@Component({
		selector: 'gz-react-extension-wrapper',
		standalone: true,
		template: '<div #host></div>',
		styles: [':host { display: contents; }']
	})
	class ReactExtensionWrapperComponent implements OnInit, OnDestroy, OnChanges {
		@Input() props?: TProps;
		@Input() context?: Record<string, unknown>;

		@ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLElement>;

		private readonly _injector = inject(Injector);
		private _root: Root | null = null;

		ngOnInit(): void {
			this._root = createRoot(this.hostRef.nativeElement);
			this._render();
		}

		ngOnChanges(changes: SimpleChanges): void {
			if (this._root && (changes['props'] || changes['context'])) {
				this._render();
			}
		}

		ngOnDestroy(): void {
			this._root?.unmount();
			this._root = null;
		}

		private _render(): void {
			if (!this._root) return;

			// Resolve props
			const resolvedDefaultProps =
				typeof defaultProps === 'function' ? (defaultProps as () => TProps)() : defaultProps;
			const finalProps = { ...resolvedDefaultProps, ...this.props } as TProps;

			// Resolve context
			const finalContext = { ...defaultContext, ...this.context };

			this._root.render(
				React.createElement(
					NgContextProvider,
					{ injector: this._injector, context: finalContext },
					// Wrap in Suspense to support React.lazy() components
					React.createElement(
						React.Suspense,
						{
							fallback: React.createElement(
								'div',
								{
									style: {
										padding: '1rem',
										textAlign: 'center',
										color: '#8f9bb3',
										fontSize: '0.875rem'
									}
								},
								'Loading…'
							)
						},
						React.createElement(reactComponent as React.ComponentType<any>, finalProps)
					)
				)
			);
		}
	}

	return ReactExtensionWrapperComponent as Type<unknown>;
}

/**
 * Define an extension that renders a React component.
 *
 * This helper creates an Angular wrapper component that hosts the React component,
 * allowing you to use React components as plugin extensions.
 *
 * @example
 * ```typescript
 * // Basic usage
 * defineReactExtension({
 *   id: 'my-react-widget',
 *   slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *   component: MyReactWidget,
 *   props: { title: 'Hello from React!' },
 *   order: 10
 * })
 * ```
 *
 * @param config Configuration for the React extension
 * @returns A ReactExtensionDefinition that can be used in plugin definitions
 */
export function defineReactExtension<TProps = Record<string, unknown>>(
	config: ReactExtensionConfig<TProps>
): ReactExtensionDefinition<TProps> {
	const wrapperComponent = createReactWrapperComponent(config.component, config.props, config.context);

	return {
		id: config.id,
		slotId: config.slotId,
		component: wrapperComponent,
		config: {
			props: typeof config.props === 'function' ? undefined : config.props,
			context: config.context
		},
		order: config.order,
		frameworkId: 'react',

		// Visibility
		permissions: config.permissions,
		permissionsAny: config.permissionsAny,
		featureKey: config.featureKey,
		visible: config.visible as any,
		hidden: config.hidden,

		// Wrapper
		wrapper: config.wrapper as any,

		// Lifecycle
		onMount: config.onMount as any,
		onUnmount: config.onUnmount as any,
		onActivate: config.onActivate as any,
		onDeactivate: config.onDeactivate as any,

		// Metadata
		metadata: config.metadata,

		// React-specific
		reactComponent: config.component,
		reactProps: config.props,
		reactContext: config.context
	};
}

/**
 * Type guard to check if an extension is a React extension.
 */
export function isReactExtension(ext: unknown): ext is ReactExtensionDefinition {
	return (
		typeof ext === 'object' &&
		ext !== null &&
		'reactComponent' in ext &&
		typeof (ext as ReactExtensionDefinition).reactComponent === 'function'
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy React Extension (Code-Splitting)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for defining a lazy-loaded React extension.
 * The React component is loaded via dynamic import for code-splitting.
 */
export interface LazyReactExtensionConfig<TProps = Record<string, unknown>> extends Omit<
	ReactExtensionConfig<TProps>,
	'component'
> {
	/**
	 * Dynamic import function that returns the React component.
	 *
	 * @example
	 * ```ts
	 * loadComponent: () => import('./HeavyDashboard').then(m => m.default)
	 * // or with named export:
	 * loadComponent: () => import('./HeavyDashboard').then(m => m.HeavyDashboard)
	 * ```
	 */
	loadComponent: () => Promise<React.ComponentType<TProps>>;
}

/**
 * Creates a dynamic Angular component that lazy-loads a React component on mount.
 * The React chunk is only downloaded when the extension is rendered.
 */
function createLazyReactWrapperComponent<TProps>(
	loadComponent: () => Promise<React.ComponentType<TProps>>,
	defaultProps?: TProps | (() => TProps),
	defaultContext?: Record<string, unknown>
): Type<unknown> {
	@Component({
		selector: 'gz-react-lazy-extension-wrapper',
		standalone: true,
		template: `
			@if (_loading) {
				<div class="react-lazy-loading">Loading…</div>
			} @else if (_error) {
				<div class="react-lazy-error">Failed to load component</div>
			} @else {
				<div #host></div>
			}
		`,
		styles: [
			`
				:host {
					display: contents;
				}
				.react-lazy-loading {
					padding: 1rem;
					text-align: center;
					color: var(--text-hint-color, #8f9bb3);
					font-size: 0.875rem;
				}
				.react-lazy-error {
					padding: 1rem;
					text-align: center;
					color: var(--color-danger-500, #ff3d71);
					font-size: 0.875rem;
				}
			`
		]
	})
	class LazyReactExtensionWrapperComponent implements OnInit, OnDestroy, OnChanges {
		@Input() props?: TProps;
		@Input() context?: Record<string, unknown>;

		@ViewChild('host', { static: false }) hostRef?: ElementRef<HTMLElement>;

		private readonly _injector = inject(Injector);
		private readonly _cdr = inject(ChangeDetectorRef);
		private _root: Root | null = null;
		private _resolvedComponent: React.ComponentType<TProps> | null = null;

		_loading = true;
		_error = false;

		async ngOnInit(): Promise<void> {
			try {
				this._resolvedComponent = await loadComponent();
				this._loading = false;
				this._cdr.detectChanges();

				// After detectChanges, the #host element is now in the DOM
				if (this.hostRef) {
					this._root = createRoot(this.hostRef.nativeElement);
					this._render();
				}
			} catch (error) {
				console.error('[LazyReactExtension] Failed to load component:', error);
				this._loading = false;
				this._error = true;
				this._cdr.markForCheck();
			}
		}

		ngOnChanges(changes: SimpleChanges): void {
			if (this._root && this._resolvedComponent && (changes['props'] || changes['context'])) {
				this._render();
			}
		}

		ngOnDestroy(): void {
			this._root?.unmount();
			this._root = null;
			this._resolvedComponent = null;
		}

		private _render(): void {
			if (!this._root || !this._resolvedComponent) return;

			const resolvedDefaultProps =
				typeof defaultProps === 'function' ? (defaultProps as () => TProps)() : defaultProps;
			const finalProps = { ...resolvedDefaultProps, ...this.props } as TProps;
			const finalContext = { ...defaultContext, ...this.context };

			this._root.render(
				React.createElement(
					NgContextProvider,
					{ injector: this._injector, context: finalContext },
					// Wrap in Suspense to support React.lazy() components
					React.createElement(
						React.Suspense,
						{
							fallback: React.createElement(
								'div',
								{
									style: {
										padding: '1rem',
										textAlign: 'center',
										color: '#8f9bb3',
										fontSize: '0.875rem'
									}
								},
								'Loading…'
							)
						},
						React.createElement(this._resolvedComponent as React.ComponentType<any>, finalProps)
					)
				)
			);
		}
	}

	return LazyReactExtensionWrapperComponent as Type<unknown>;
}

/**
 * Define a lazy-loaded React extension for code-splitting.
 *
 * The React component is loaded via dynamic import only when the extension
 * is rendered, keeping the initial bundle small.
 *
 * @example
 * ```typescript
 * defineLazyReactExtension({
 *   id: 'heavy-dashboard-widget',
 *   slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *   loadComponent: () => import('./HeavyDashboard').then(m => m.default),
 *   props: { columns: 3 },
 *   order: 20
 * })
 * ```
 *
 * @param config Configuration with `loadComponent` instead of `component`
 * @returns A ReactExtensionDefinition that can be used in plugin definitions
 */
export function defineLazyReactExtension<TProps = Record<string, unknown>>(
	config: LazyReactExtensionConfig<TProps>
): ReactExtensionDefinition<TProps> {
	const wrapperComponent = createLazyReactWrapperComponent(config.loadComponent, config.props, config.context);

	// Use a placeholder component type for reactComponent since the real one is lazy
	const placeholderComponent = (() => null) as unknown as React.ComponentType<TProps>;

	return {
		id: config.id,
		slotId: config.slotId,
		component: wrapperComponent,
		config: {
			props: typeof config.props === 'function' ? undefined : config.props,
			context: config.context
		},
		order: config.order,
		frameworkId: 'react',

		// Visibility
		permissions: config.permissions,
		permissionsAny: config.permissionsAny,
		featureKey: config.featureKey,
		visible: config.visible as any,
		hidden: config.hidden,

		// Wrapper
		wrapper: config.wrapper as any,

		// Lifecycle
		onMount: config.onMount as any,
		onUnmount: config.onUnmount as any,
		onActivate: config.onActivate as any,
		onDeactivate: config.onDeactivate as any,

		// Metadata
		metadata: config.metadata,

		// React-specific (placeholder — real component loaded lazily)
		reactComponent: placeholderComponent,
		reactProps: config.props,
		reactContext: config.context
	};
}
