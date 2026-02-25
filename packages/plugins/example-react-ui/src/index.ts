/*
 * Public API Surface of @gauzy/plugin-example-react-ui
 *
 * This package demonstrates how to integrate React components
 * into Angular using @gauzy/ui-react-bridge and @gauzy/plugin-ui.
 */

// Plugin definitions
export { ExampleReactPlugin, ExampleReactPluginSimple } from './lib/example-react-plugin';

// Angular module
export { ExampleReactUiModule } from './lib/example-react-ui.module';

// Angular components (hosting React)
export { ExampleReactPageComponent } from './lib/example-react-page.component';

// React components (can be imported directly)
export * from './lib/react-components';
