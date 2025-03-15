import { PluginInstallationService } from './plugin-installation.service';
import { PluginSecurityService } from './plugin-security.service';
import { PluginSourceService } from './plugin-source.service';
import { PluginVersionService } from './plugin-version.service';
import { PluginService } from './plugin.service';

export const services = [
	PluginService,
	PluginInstallationService,
	PluginSourceService,
	PluginVersionService,
	PluginSecurityService
];
