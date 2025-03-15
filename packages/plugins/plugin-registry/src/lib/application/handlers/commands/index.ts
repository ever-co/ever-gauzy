import { ActivatePluginCommandHandler } from './activate-plugin-command.handler';
import { DeactivatePluginCommandHandler } from './deactivate-plugin-command.handler';
import { DeletePluginCommandHandler } from './delete-plugin-command.handler';
import { InstallPluginCommandHandler } from './install-plugin-command.handler';
import { UninstallPluginCommandHandler } from './uninstall-plugin-command.handler';
import { UpdatePluginCommandHandler } from './update-plugin-command.handler';

export const commands = [
	InstallPluginCommandHandler,
	UninstallPluginCommandHandler,
	UpdatePluginCommandHandler,
	ActivatePluginCommandHandler,
	DeactivatePluginCommandHandler,
	DeletePluginCommandHandler
];
