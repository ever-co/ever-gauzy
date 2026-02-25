import {
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
}

/**
 * React extension definition that can be used in plugin definitions.
 * Extends the base PageExtensionDefinition interface from @gauzy/plugin-ui.
 */
export interface ReactExtensionDefinition<TProps = Record<string, unknown>> {
	id: string;
	slotId: string;
	component: Type<unknown>; // Angular component class
	order?: number;
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
					React.createElement(reactComponent, finalProps)
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
 * import { defineReactExtension } from '@gauzy/ui-react-bridge';
 * import { PAGE_EXTENSION_SLOTS, PluginUiDefinition } from '@gauzy/plugin-ui';
 * import { MyReactWidget } from './react/MyReactWidget';
 *
 * export const MyPlugin: PluginUiDefinition = {
 *   id: 'my-plugin',
 *   module: MyPluginModule,
 *   extensions: [
 *     defineReactExtension({
 *       id: 'my-react-widget',
 *       slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *       component: MyReactWidget,
 *       props: { title: 'Hello from React!' },
 *       order: 10
 *     })
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // With dynamic props using a factory function
 * defineReactExtension({
 *   id: 'dynamic-widget',
 *   slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *   component: DynamicWidget,
 *   props: () => ({
 *     timestamp: Date.now(),
 *     config: loadConfig()
 *   })
 * })
 * ```
 *
 * @param config Configuration for the React extension
 * @returns An ExtensionDefinition that can be used in plugin definitions
 */
export function defineReactExtension<TProps = Record<string, unknown>>(
	config: ReactExtensionConfig<TProps>
): ReactExtensionDefinition<TProps> {
	const wrapperComponent = createReactWrapperComponent(config.component, config.props, config.context);

	return {
		id: config.id,
		slotId: config.slotId,
		component: wrapperComponent,
		order: config.order,
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
