// Allowed: the API's plugin list imports the modules through their entry points.
import { EverConnectPlugin } from '@gauzy/plugin-ever-connect';
import { EverStatsPlugin } from '@gauzy/plugin-ever-stats';
export const plugins = [EverConnectPlugin, EverStatsPlugin];
