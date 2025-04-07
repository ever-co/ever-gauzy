import { PluginInstallationSubscriber } from './plugin-installation.subscriber';
import { PluginSourceSubscriber } from './plugin-source.subscriber';
import { PluginVersionSubscriber } from './plugin-version.subscriber';
import { PluginSubscriber } from './plugin.subscriber';

export const subscribers = [
	PluginSourceSubscriber,
	PluginVersionSubscriber,
	PluginSubscriber,
	PluginInstallationSubscriber
];
