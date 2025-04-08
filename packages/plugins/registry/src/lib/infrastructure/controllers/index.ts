import { PluginActivationController } from './plugin-activation.controller';
import { PluginInstallationController } from './plugin-installation.controller';
import { PluginManagementController } from './plugin-management.controller';
import { PluginSecurityController } from './plugin-security.controller';
import { PluginVersionController } from './plugin-version.controller';
import { PluginController } from './plugin.controller';

export const controllers = [
	PluginManagementController,
	PluginActivationController,
	PluginInstallationController,
	PluginSecurityController,
	PluginVersionController,
	PluginController
];
