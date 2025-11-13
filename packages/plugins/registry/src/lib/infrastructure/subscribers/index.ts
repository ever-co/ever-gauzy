import { PluginInstallationSubscriber } from './plugin-installation.subscriber';
import { PluginSourceSubscriber } from './plugin-source.subscriber';
import { PluginSubscriptionSubscriber } from './plugin-subscription.subscriber';
import { PluginVersionSubscriber } from './plugin-version.subscriber';
import { PluginSubscriber } from './plugin.subscriber';

export const subscribers = [
	PluginSourceSubscriber,
	PluginVersionSubscriber,
	PluginSubscriber,
	PluginInstallationSubscriber,
	PluginSubscriptionSubscriber
];

export * from './plugin-installation.subscriber';
export * from './plugin-source.subscriber';
export * from './plugin-subscription.subscriber';
export * from './plugin-version.subscriber';
export * from './plugin.subscriber';
