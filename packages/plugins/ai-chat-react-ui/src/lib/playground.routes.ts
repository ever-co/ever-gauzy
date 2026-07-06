import { PageRouteRegistryConfig } from '@gauzy/ui-core/core';
import { PlaygroundPageComponent } from './playground-page.component';

/** Path segment for the AI Playground under /pages. */
export const PLAYGROUND_PATH = 'playground';

/**
 * Route config for the AI Playground page.
 * Registered at `page-sections` so it appears as /pages/playground.
 */
export const PLAYGROUND_ROUTE: PageRouteRegistryConfig = {
	location: 'page-sections',
	path: PLAYGROUND_PATH,
	component: PlaygroundPageComponent
};
