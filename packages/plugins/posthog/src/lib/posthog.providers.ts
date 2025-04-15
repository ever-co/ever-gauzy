import { PosthogModuleOptions } from './posthog.interfaces';
import { POSTHOG_TOKEN } from './posthog.constants';
import { PosthogService } from './posthog.service';

export function createPosthogProviders(options: PosthogModuleOptions) {
	return {
		provide: POSTHOG_TOKEN,
		useFactory: () => new PosthogService(options)
	};
}
