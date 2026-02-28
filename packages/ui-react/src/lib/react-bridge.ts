import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { NgContextProvider } from './ng-react-context';
import {
	UiBridge,
	UiBridgeConfig,
	UiBridgeMountOptions,
	UiBridgeMountResult,
	UI_BRIDGE_FRAMEWORK
} from '@gauzy/plugin-ui';

// Convenience type aliases
export type ReactBridgeConfig = UiBridgeConfig;
export type ReactBridgeMountOptions<TProps = unknown, TContext = unknown> = UiBridgeMountOptions<TProps, TContext>;
export type ReactBridgeMountResult = UiBridgeMountResult;

/**
 * React bridge for rendering React components inside Angular.
 *
 * Implements UiBridge using the React 18+ createRoot API to mount React
 * components and provides access to Angular services via NgContextProvider.
 *
 * @example
 * ```typescript
 * const bridge = new ReactBridge();
 * const result = bridge.mount({
 *   component: MyReactComponent,
 *   props: { title: 'Hello!' },
 *   hostElement: element,
 *   injector: angularInjector
 * });
 *
 * // Later, to unmount:
 * result.unmount();
 * ```
 */
export class ReactBridge extends UiBridge {
	readonly config: UiBridgeConfig = {
		frameworkId: UI_BRIDGE_FRAMEWORK.REACT,
		name: 'React Bridge',
		version: '1.0.0'
	};

	/**
	 * Mount a React component into an Angular host element.
	 */
	mount(options: UiBridgeMountOptions): UiBridgeMountResult {
		const { component, props, context, hostElement, injector } = options;

		const root: Root = createRoot(hostElement);

		const renderElement = (currentProps: unknown) => {
			const element = React.createElement(
				NgContextProvider,
				{
					injector,
					context: (context as Record<string, unknown>) ?? {}
				},
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
					React.createElement(component as React.ComponentType, currentProps as Record<string, unknown>)
				)
			);
			root.render(element);
		};

		renderElement(props);

		return {
			unmount: () => {
				root.unmount();
			},
			updateProps: (newProps: unknown) => {
				renderElement(newProps);
			}
		};
	}

	/**
	 * Check if a component is compatible with React.
	 */
	isCompatible(component: unknown): boolean {
		if (!component) {
			return false;
		}

		if (typeof component === 'function') {
			const proto = (component as { prototype?: { isReactComponent?: boolean } }).prototype;
			if (proto?.isReactComponent) {
				return true;
			}
			if ((component as Function).length <= 2) {
				return true;
			}
		}

		if (typeof component === 'object') {
			if ('$$typeof' in component) {
				return true;
			}
		}

		return false;
	}
}
