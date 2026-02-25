import { definePlugin, PAGE_EXTENSION_SLOTS, PluginUiDefinition } from '@gauzy/plugin-ui';
import {
	defineReactExtension,
	ReactExtensionLifecycleContext,
	ReactExtensionVisibilityContext
} from '@gauzy/ui-react-bridge';
import { ExampleReactUiModule } from './example-react-ui.module';
import { ExampleReactWidget, ExampleReactCard, ExampleReactWindow } from './react-components';

/**
 * Example React Plugin Definition.
 *
 * This plugin demonstrates the full plugin-ui feature set with React:
 *
 * 1. **Route Registration** - A full page with React components
 * 2. **defineReactExtension()** - Register React components as dashboard extensions
 * 3. **Navigation Menu** - Add menu items to the sidebar
 * 4. **Lifecycle Hooks** - onMount, onUnmount for initialization/cleanup
 * 5. **Visibility Control** - permissions, featureKey, custom visibility
 * 6. **Wrappers** - Built-in card/widget/window styling
 * 7. **Metadata** - Title, description, icon for extensions
 *
 * ## Usage
 *
 * Add to your plugin config:
 * ```typescript
 * import { ExampleReactPlugin } from '@gauzy/plugin-example-react-ui';
 *
 * export const PLUGIN_UI_CONFIG: PluginUiConfig = {
 *   plugins: [ExampleReactPlugin]
 * };
 * ```
 *
 * Then navigate to `/pages/example-react` to see React components.
 */
export const ExampleReactPlugin: PluginUiDefinition = {
	id: 'example-react',
	location: 'page-sections',
	module: ExampleReactUiModule,

	// ─────────────────────────────────────────────────────────────
	// 1. Register Routes
	// ─────────────────────────────────────────────────────────────
	routes: [
		{
			location: 'page-sections',
			path: 'example-react',
			loadChildren: () => import('./example-react-ui.module').then((m) => m.ExampleReactUiModule),
			data: {
				title: 'React Examples'
			}
		}
	],

	// ─────────────────────────────────────────────────────────────
	// 2. Register Navigation Menu Items
	// ─────────────────────────────────────────────────────────────
	navMenu: [
		{
			type: 'section',
			sectionId: 'miscellaneous',
			items: [
				{
					id: 'example-react-nav',
					title: 'React Examples',
					icon: 'cube-outline', // Nebular icon
					link: '/pages/example-react',
					data: {
						translationKey: 'MENU.REACT_EXAMPLES'
					}
				}
			]
		}
	],

	// ─────────────────────────────────────────────────────────────
	// 3. Register React Components as Extensions
	//    Demonstrating all available features
	// ─────────────────────────────────────────────────────────────
	extensions: [
		// ─── Basic Extension with Lifecycle Hooks ─────────────────
		defineReactExtension({
			id: 'example-react-dashboard-widget',
			slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
			component: ExampleReactWidget,
			props: {
				title: 'React Dashboard Widget',
				description: 'This interactive widget is rendered using React inside the Angular dashboard!'
			},
			order: 100,
			// Lifecycle hooks for initialization and cleanup
			onMount: (ctx: ReactExtensionLifecycleContext) => {
				console.log(`[ExampleReactPlugin] Widget mounted in slot: ${ctx.slotId}`);
			},
			onUnmount: (ctx: ReactExtensionLifecycleContext) => {
				console.log(`[ExampleReactPlugin] Widget unmounted from slot: ${ctx.slotId}`);
			},
			// Metadata for display purposes
			metadata: {
				title: 'React Widget',
				description: 'An interactive React widget example',
				category: 'examples',
				tags: ['react', 'widget', 'demo']
			}
		}),

		// ─── Stats Card with Wrapper ──────────────────────────────
		defineReactExtension({
			id: 'example-react-stats-card-1',
			slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
			component: ExampleReactCard,
			props: {
				title: 'React Users',
				value: '1,234',
				icon: '👥',
				color: 'blue'
			},
			order: 101,
			// Use 'widget' wrapper for consistent styling
			wrapper: 'widget',
			metadata: {
				title: 'Users Count',
				icon: 'people-outline'
			}
		}),

		// ─── Stats Card with Custom Wrapper Config ────────────────
		defineReactExtension({
			id: 'example-react-stats-card-2',
			slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
			component: ExampleReactCard,
			props: {
				title: 'React Revenue',
				value: '$45,678',
				icon: '💰',
				color: 'green'
			},
			order: 102,
			// Custom wrapper with title
			wrapper: {
				type: 'card',
				title: 'Revenue Stats',
				showHeader: true,
				cssClass: 'revenue-card'
			}
		}),

		// ─── Extension with Visibility Control ────────────────────
		// This extension is only visible to users with specific permissions
		defineReactExtension({
			id: 'example-react-admin-card',
			slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
			component: ExampleReactCard,
			props: {
				title: 'Admin Only',
				value: 'Secret',
				icon: '🔒',
				color: 'red'
			},
			order: 103,
			// Visibility control: Only show for admins
			// permissions: ['ADMIN'], // Uncomment to enable permission check
			// featureKey: 'FEATURE_ADMIN_DASHBOARD', // Uncomment to enable feature flag
			// Custom visibility function
			visible: (_ctx: ReactExtensionVisibilityContext) => {
				// Return true to show, false to hide
				// Example: check if user is admin
				// return ctx.user?.role === 'ADMIN';
				return true; // Always visible for demo
			},
			metadata: {
				title: 'Admin Dashboard',
				description: 'Visible only to administrators'
			}
		}),

		// ─── Window Extension with All Features ───────────────────
		defineReactExtension({
			id: 'example-react-dashboard-window',
			slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WINDOWS,
			component: ExampleReactWindow,
			props: {
				title: 'React Tasks Window',
				description: 'This window panel is rendered using React inside the Angular Time Tracking dashboard!'
			},
			order: 100,
			// Use 'window' wrapper for larger panels
			wrapper: 'window',
			// Lifecycle hooks
			onMount: async (ctx: ReactExtensionLifecycleContext) => {
				console.log(`[ExampleReactPlugin] Window mounted:`, ctx.extension.id);
				// Can do async initialization here
			},
			onUnmount: (ctx: ReactExtensionLifecycleContext) => {
				console.log(`[ExampleReactPlugin] Window unmounted:`, ctx.extension.id);
			},
			onActivate: (ctx: ReactExtensionLifecycleContext) => {
				console.log(`[ExampleReactPlugin] Window activated:`, ctx.extension.id);
			},
			onDeactivate: (ctx: ReactExtensionLifecycleContext) => {
				console.log(`[ExampleReactPlugin] Window deactivated:`, ctx.extension.id);
			},
			// Metadata
			metadata: {
				title: 'React Tasks',
				description: 'A React-powered tasks window',
				icon: 'checkmark-square-outline',
				category: 'productivity',
				tags: ['react', 'tasks', 'window']
			}
		})
	]
};

// ─────────────────────────────────────────────────────────────────────
// Alternative: Using definePlugin() helper for simple plugins
// ─────────────────────────────────────────────────────────────────────
/**
 * Example using definePlugin() helper function.
 *
 * Use this for simple plugins that only need a module and location.
 * For plugins with routes, navMenu, or extensions, use the full
 * PluginUiDefinition object instead.
 */
export const ExampleReactPluginSimple = definePlugin('example-react-simple', ExampleReactUiModule, {
	location: 'page-sections'
});
