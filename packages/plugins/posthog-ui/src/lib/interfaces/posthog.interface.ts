import { InjectionToken } from '@angular/core';
import { PostHogConfig } from 'posthog-js';

/**
 * Configuration interface for PostHog initialization
 */
export interface PostHogModuleConfig {
	apiKey: string;
	options?: Partial<PostHogConfig>;
}

/**
 * Injection token for providing PostHog configuration
 */
export const POSTHOG_CONFIG = new InjectionToken<PostHogModuleConfig>('POSTHOG_CONFIG');
