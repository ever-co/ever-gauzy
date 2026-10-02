import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { PlaygroundPageComponent } from './playground-page.component';

/** Path segment for the AI Playground under /pages. */
export const PLAYGROUND_PATH = 'playground';

/**
 * Route config for the AI Playground page.
 * Registered at `page-sections` so it appears as /pages/playground.
 *
 * Guarded by `AI_CHAT_ACCESS`, the permission every endpoint the playground calls
 * (`POST /api/ai-chat`, `GET /api/ai-chat/config`) already requires: without the guard a
 * user lacking it could open the page directly and get a playground whose every request 403s.
 */
export const PLAYGROUND_ROUTE: PageRouteRegistryConfig = {
	location: 'page-sections',
	path: PLAYGROUND_PATH,
	component: PlaygroundPageComponent,
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.AI_CHAT_ACCESS],
			redirectTo: '/pages/dashboard'
		}
	}
};
