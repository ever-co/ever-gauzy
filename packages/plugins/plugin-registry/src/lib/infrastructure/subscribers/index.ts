import { PluginSourceSubscriber } from './plugin-source.subscriber';
import { PluginVersionSubscriber } from './plugin-version.subscriber';

export const subscribers = [PluginSourceSubscriber, PluginVersionSubscriber];
