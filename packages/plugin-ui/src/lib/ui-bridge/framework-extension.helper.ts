import { ExtensionDefinition, ExtensionSlotId } from '../plugin-extension';
import { UiBridgeFramework } from './ui-bridge.interface';

/**
 * Configuration for defining a framework extension.
 */
export interface FrameworkExtensionConfig<TProps = unknown, TContext = unknown> {
	/** Unique id for this extension */
	id: string;
	/** Slot this extension contributes to */
	slotId: ExtensionSlotId;
	/** Framework identifier (e.g., 'react', 'vue', 'svelte') */
	frameworkId: UiBridgeFramework;
	/** The framework component to render */
	frameworkComponent: unknown;
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
export interface FrameworkExtensionDefinition<TProps = unknown, TContext = unknown>
	extends ExtensionDefinition<{
		frameworkId: UiBridgeFramework;
		component: unknown;
		props?: TProps;
		context?: TContext;
	}> {
	/** Framework identifier */
	frameworkId: UiBridgeFramework;
	/** The framework component */
	frameworkComponent: unknown;
	/** Props for the framework component */
	frameworkProps?: TProps | (() => TProps);
	/** Additional context */
	frameworkContext?: TContext;
}

/**
 * Define an extension that renders a non-Angular framework component.
 *
 * @example
 * ```typescript
 * import { defineFrameworkExtension, UI_BRIDGE_FRAMEWORK, EXTENSION_SLOTS } from '@gauzy/plugin-ui';
 * import { MyReactWidget } from './react-components/MyReactWidget';
 *
 * export const MyPlugin: PluginUiDefinition = {
 *   id: 'my-plugin',
 *   extensions: [
 *     defineFrameworkExtension({
 *       id: 'my-react-widget',
 *       slotId: EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *       frameworkId: UI_BRIDGE_FRAMEWORK.REACT,
 *       frameworkComponent: MyReactWidget,
 *       frameworkProps: { title: 'Hello from React!' },
 *       order: 10
 *     })
 *   ]
 * };
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
 */
export function isFrameworkExtension(ext: ExtensionDefinition): ext is FrameworkExtensionDefinition {
	return 'frameworkId' in ext && 'frameworkComponent' in ext;
}

/**
 * Get the framework ID from an extension if it's a framework extension.
 */
export function getExtensionFrameworkId(ext: ExtensionDefinition): UiBridgeFramework | undefined {
	return isFrameworkExtension(ext) ? ext.frameworkId : undefined;
}
