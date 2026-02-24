import { Injector } from '@angular/core';

/**
 * Well-known UI framework identifiers.
 * Use these constants for consistency, or define custom framework IDs.
 */
export const UI_BRIDGE_FRAMEWORK = {
	/** React framework (react, react-dom) */
	REACT: 'react',
	/** Vue.js framework */
	VUE: 'vue',
	/** Svelte framework */
	SVELTE: 'svelte',
	/** Preact framework (lightweight React alternative) */
	PREACT: 'preact',
	/** Solid.js framework */
	SOLID: 'solid',
	/** Qwik framework */
	QWIK: 'qwik'
} as const;

/**
 * Type for UI framework identifiers.
 * Can be a well-known framework or a custom string.
 */
export type UiBridgeFramework = (typeof UI_BRIDGE_FRAMEWORK)[keyof typeof UI_BRIDGE_FRAMEWORK] | string;

/**
 * Configuration metadata for a UI bridge.
 */
export interface UiBridgeConfig {
	/** Unique framework identifier (e.g., 'react', 'vue', 'svelte') */
	frameworkId: UiBridgeFramework;
	/** Human-readable name for the bridge */
	name: string;
	/** Version of the bridge implementation */
	version: string;
}

/**
 * Options for mounting a framework component into Angular.
 */
export interface UiBridgeMountOptions<TProps = unknown, TContext = unknown> {
	/** The framework component to mount (type depends on the framework) */
	component: unknown;
	/** Props to pass to the component */
	props?: TProps;
	/** Additional context to provide (merged with injector) */
	context?: TContext;
	/** Host DOM element to mount the component into */
	hostElement: HTMLElement;
	/** Angular injector for accessing Angular services */
	injector: Injector;
}

/**
 * Result returned after mounting a framework component.
 */
export interface UiBridgeMountResult {
	/** Cleanup function to unmount the component and release resources */
	unmount: () => void;
	/** Optional function to update props on the mounted component */
	updateProps?: (props: unknown) => void;
}

/**
 * Abstract base class for UI framework bridges.
 *
 * Implement this class to create a bridge for any UI framework
 * (React, Vue, Svelte, etc.) that can render components inside Angular.
 *
 * @example
 * ```typescript
 * export class ReactBridge extends UiBridge {
 *   readonly config: UiBridgeConfig = {
 *     frameworkId: UI_BRIDGE_FRAMEWORK.REACT,
 *     name: 'React Bridge',
 *     version: '1.0.0'
 *   };
 *
 *   mount(options: UiBridgeMountOptions): UiBridgeMountResult {
 *     // Mount React component using createRoot
 *     const root = createRoot(options.hostElement);
 *     root.render(createElement(options.component, options.props));
 *     return { unmount: () => root.unmount() };
 *   }
 *
 *   isCompatible(component: unknown): boolean {
 *     // Check if component is a React component
 *     return typeof component === 'function';
 *   }
 * }
 * ```
 */
export abstract class UiBridge {
	/** Configuration metadata for this bridge */
	abstract readonly config: UiBridgeConfig;

	/**
	 * Mount a framework component into an Angular host element.
	 *
	 * @param options Mount configuration including component, props, and host element
	 * @returns Mount result with unmount function and optional updateProps
	 */
	abstract mount(options: UiBridgeMountOptions): UiBridgeMountResult;

	/**
	 * Check if a component is compatible with this bridge.
	 *
	 * Used for auto-detection when frameworkId is not explicitly specified.
	 *
	 * @param component The component to check
	 * @returns True if this bridge can handle the component
	 */
	abstract isCompatible(component: unknown): boolean;
}
