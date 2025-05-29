import { ActivatePluginCommandHandler } from './activate-plugin-command.handler';
import { CreatePluginCommandHandler } from './create-plugin-command.handler';
import { CreatePluginSourceCommandHandler } from './create-plugin-source-command.handler';
import { CreatePluginVersionCommandHandler } from './create-plugin-version-command.handler';
import { DeactivatePluginCommandHandler } from './deactivate-plugin-command.handler';
import { DeletePluginSourceCommandHandler } from './delete-plugin-source-command.handler';
import { DeletePluginCommandHandler } from './delete-plugin-command.handler';
import { DeletePluginVersionCommandHandler } from './delete-plugin-version-command.handler';
import { InstallPluginCommandHandler } from './install-plugin-command.handler';
import { RecoverPluginSourceCommandHandler } from './recover-plugin-source-command.handler';
import { RecoverPluginVersionCommandHandler } from './recover-plugin-version-command.handler';
import { UninstallPluginCommandHandler } from './uninstall-plugin-command.handler';
import { UpdatePluginCommandHandler } from './update-plugin-command.handler';
import { UpdatePluginVersionCommandHandler } from './update-plugin-version-command.handler';
import { VerifyPluginCommandHandler } from './verify-plugin-command.handler';

export const commands = [
	InstallPluginCommandHandler,
	UninstallPluginCommandHandler,
	CreatePluginCommandHandler,
	UpdatePluginCommandHandler,
	ActivatePluginCommandHandler,
	DeactivatePluginCommandHandler,
	DeletePluginCommandHandler,
	VerifyPluginCommandHandler,
	CreatePluginVersionCommandHandler,
	DeletePluginVersionCommandHandler,
	RecoverPluginVersionCommandHandler,
	UpdatePluginVersionCommandHandler,
	CreatePluginSourceCommandHandler,
	DeletePluginSourceCommandHandler,
	RecoverPluginSourceCommandHandler
];
