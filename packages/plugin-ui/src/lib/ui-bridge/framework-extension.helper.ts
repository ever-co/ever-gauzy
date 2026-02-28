import { PageExtensionDefinition, PageExtensionSlotId } from '../plugin-extension';
import { UiBridgeFramework } from './ui-bridge.interface';

/**
 * Configuration for defining a framework extension.
 */
export interface FrameworkExtensionConfig<TProps = unknown, TContext = unknown> {
	/** Unique id for this extension */
	id: string;
	/** Slot this extension contributes to */
	slotId: PageExtensionSlotId;
	/** Framework identifier (e.g., 'react', 'vue', 'svelte') */
	frameworkId: UiBridgeFramework;
	/**
	 * The framework component to render (eager).
	 * Optional when `loadFrameworkComponent` is provided.
	 */
	frameworkComponent?: unknown;
	/**
	 * Lazy-load the framework component for code-splitting.
	 * Mutually exclusive with `frameworkComponent` — if both are set,
	 * `loadFrameworkComponent` takes precedence.
	 *
	 * @example
	 * ```ts
	 * loadFrameworkComponent: () => import('./HeavyChart').then(m => m.HeavyChart)
	 * ```
	 */
	loadFrameworkComponent?: () => Promise<unknown>;
	/** Props to pass to the framework component */
	frameworkProps?: TProps | (() => TProps);
	/** Additional context for the component */
	frameworkContext?: TContext;
	/** Optional order hint (lower = earlier) */
	order?: number;
}

/**
 * Extended extension definition for framework components.
 */
export interface FrameworkExtensionDefinition<TProps = unknown, TContext = unknown> extends PageExtensionDefinition<{
	frameworkId: UiBridgeFramework;
	component: unknown;
	props?: TProps;
	context?: TContext;
}> {
	/** Framework identifier */
	frameworkId: UiBridgeFramework;
	/** The framework component (may be undefined if lazy-loaded) */
	frameworkComponent?: unknown;
	/**
	 * Lazy-load the framework component for code-splitting.
	 * When provided, the component is resolved on first render.
	 */
	loadFrameworkComponent?: () => Promise<unknown>;
	/** Props for the framework component */
	frameworkProps?: TProps | (() => TProps);
	/** Additional context */
	frameworkContext?: TContext;
}

/**
 * Define an extension that renders a non-Angular framework component.
 *
 * Supports both eager and lazy framework components for code-splitting.
 *
 * @example
 * ```typescript
 * // Eager (imported at definition time)
 * defineFrameworkExtension({
 *   id: 'my-react-widget',
 *   slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *   frameworkId: UI_BRIDGE_FRAMEWORK.REACT,
 *   frameworkComponent: MyReactWidget,
 *   frameworkProps: { title: 'Hello from React!' },
 *   order: 10
 * })
 *
 * // Lazy (loaded on first render)
 * defineFrameworkExtension({
 *   id: 'heavy-chart',
 *   slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WINDOWS,
 *   frameworkId: UI_BRIDGE_FRAMEWORK.REACT,
 *   loadFrameworkComponent: () => import('./HeavyChart').then(m => m.HeavyChart),
 *   order: 20
 * })
 * ```
 */
export function defineFrameworkExtension<TProps = unknown, TContext = unknown>(
	config: FrameworkExtensionConfig<TProps, TContext>
): FrameworkExtensionDefinition<TProps, TContext> {
	const resolvedProps =
		typeof config.frameworkProps === 'function' ? (config.frameworkProps as () => TProps)() : config.frameworkProps;

	return {
		id: config.id,
		slotId: config.slotId,
		order: config.order,
		frameworkId: config.frameworkId,
		frameworkComponent: config.frameworkComponent,
		loadFrameworkComponent: config.loadFrameworkComponent,
		frameworkProps: config.frameworkProps,
		frameworkContext: config.frameworkContext,
		config: {
			frameworkId: config.frameworkId,
			component: config.frameworkComponent,
			props: resolvedProps,
			context: config.frameworkContext
		}
	};
}

/**
 * Type guard to check if an extension is a framework extension.
 * Recognizes both eager (`frameworkComponent`) and lazy (`loadFrameworkComponent`) extensions.
 */
export function isFrameworkExtension(ext: PageExtensionDefinition): ext is FrameworkExtensionDefinition {
	return 'frameworkId' in ext && ('frameworkComponent' in ext || 'loadFrameworkComponent' in ext);
}

/**
 * Get the framework ID from an extension if it's a framework extension.
 */
export function getExtensionFrameworkId(ext: PageExtensionDefinition): UiBridgeFramework | undefined {
	return isFrameworkExtension(ext) ? ext.frameworkId : undefined;
}
