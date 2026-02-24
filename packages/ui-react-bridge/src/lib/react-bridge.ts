import { Injector } from '@angular/core';
import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { NgContextProvider } from './ng-react-context';

/**
 * Configuration for a React bridge.
 */
export interface ReactBridgeConfig {
	frameworkId: string;
	name: string;
	version: string;
}

/**
 * Options for mounting a React component.
 */
export interface ReactBridgeMountOptions<TProps = unknown, TContext = unknown> {
	component: unknown;
	props?: TProps;
	context?: TContext;
	hostElement: HTMLElement;
	injector: Injector;
}

/**
 * Result from mounting a React component.
 */
export interface ReactBridgeMountResult {
	unmount: () => void;
	updateProps?: (props: unknown) => void;
}

/**
 * React bridge for rendering React components inside Angular.
 *
 * This bridge uses React 18+ createRoot API to mount React components
 * and provides access to Angular services via NgContextProvider.
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
export class ReactBridge {
	readonly config: ReactBridgeConfig = {
		frameworkId: 'react',
		name: 'React Bridge',
		version: '1.0.0'
	};

	/**
	 * Mount a React component into an Angular host element.
	 */
	mount(options: ReactBridgeMountOptions): ReactBridgeMountResult {
		const { component, props, context, hostElement, injector } = options;

		const root: Root = createRoot(hostElement);

		const renderElement = (currentProps: unknown) => {
			const element = React.createElement(
				NgContextProvider,
				{
					injector,
					context: (context as Record<string, unknown>) ?? {}
				},
				React.createElement(component as React.ComponentType, currentProps as Record<string, unknown>)
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

		if (typeof component === 'object' && component !== null) {
			if ('$$typeof' in component) {
				return true;
			}
		}

		return false;
	}
}
