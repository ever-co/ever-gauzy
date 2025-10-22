// Plugin Management Command Handlers
import { ActivatePluginCommandHandler } from './activate-plugin-command.handler';
import { CreatePluginCommandHandler } from './create-plugin-command.handler';
import { DeactivatePluginCommandHandler } from './deactivate-plugin-command.handler';
import { DeletePluginCommandHandler } from './delete-plugin-command.handler';
import { InstallPluginCommandHandler } from './install-plugin-command.handler';
import { UninstallPluginCommandHandler } from './uninstall-plugin-command.handler';
import { UpdatePluginCommandHandler } from './update-plugin-command.handler';
import { VerifyPluginCommandHandler } from './verify-plugin-command.handler';

// Plugin Version Command Handlers
import { CreatePluginVersionCommandHandler } from './create-plugin-version-command.handler';
import { DeletePluginVersionCommandHandler } from './delete-plugin-version-command.handler';
import { RecoverPluginVersionCommandHandler } from './recover-plugin-version-command.handler';
import { UpdatePluginVersionCommandHandler } from './update-plugin-version-command.handler';

// Plugin Source Command Handlers
import { CreatePluginSourceCommandHandler } from './create-plugin-source-command.handler';
import { DeletePluginSourceCommandHandler } from './delete-plugin-source-command.handler';
import { RecoverPluginSourceCommandHandler } from './recover-plugin-source-command.handler';

// Plugin Category Command Handlers
import { CreatePluginCategoryHandler } from './create-plugin-category.handler';
import { DeletePluginCategoryHandler } from './delete-plugin-category.handler';
import { UpdatePluginCategoryHandler } from './update-plugin-category.handler';

// Plugin Subscription Command Handlers
import { CancelPluginSubscriptionCommandHandler } from './cancel-plugin-subscription.handler';
import { CreatePluginSubscriptionCommandHandler } from './create-plugin-subscription.handler';
import { DeletePluginSubscriptionCommandHandler } from './delete-plugin-subscription.handler';
import { ProcessBillingCommandHandler } from './process-billing.handler';
import { PurchasePluginSubscriptionCommandHandler } from './purchase-plugin-subscription.handler';
import { RenewPluginSubscriptionCommandHandler } from './renew-plugin-subscription.handler';
import { UpdatePluginSubscriptionCommandHandler } from './update-plugin-subscription.handler';

// Plugin Settings Command Handlers
import { BulkUpdatePluginSettingsHandler } from './bulk-update-plugin-settings.handler';
import { CreatePluginSettingHandler } from './create-plugin-setting.handler';
import { DeletePluginSettingHandler } from './delete-plugin-setting.handler';
import { SetPluginSettingValueHandler } from './set-plugin-setting-value.handler';
import { UpdatePluginSettingHandler } from './update-plugin-setting.handler';

// Plugin Configuration Command Handlers
import { PluginConfigGetHandler } from './plugin-config-get.handler';
import { PluginConfigSetHandler } from './plugin-config-set.handler';
import { PluginInstallHandler } from './plugin-install.handler';
import { PluginUninstallHandler } from './plugin-uninstall.handler';

// Export individual handlers
export {
	// Plugin Management Command Handlers
	ActivatePluginCommandHandler,
	// Plugin Settings Command Handlers
	BulkUpdatePluginSettingsHandler,
	// Plugin Subscription Command Handlers
	CancelPluginSubscriptionCommandHandler,
	// Plugin Category Command Handlers
	CreatePluginCategoryHandler,
	CreatePluginCommandHandler,
	CreatePluginSettingHandler,
	// Plugin Source Command Handlers
	CreatePluginSourceCommandHandler,
	CreatePluginSubscriptionCommandHandler,
	// Plugin Version Command Handlers
	CreatePluginVersionCommandHandler,
	DeactivatePluginCommandHandler,
	DeletePluginCategoryHandler,
	DeletePluginCommandHandler,
	DeletePluginSettingHandler,
	DeletePluginSourceCommandHandler,
	DeletePluginSubscriptionCommandHandler,
	DeletePluginVersionCommandHandler,
	InstallPluginCommandHandler,
	// Plugin Configuration Command Handlers
	PluginConfigGetHandler,
	PluginConfigSetHandler,
	PluginInstallHandler,
	PluginUninstallHandler,
	ProcessBillingCommandHandler,
	PurchasePluginSubscriptionCommandHandler,
	RecoverPluginSourceCommandHandler,
	RecoverPluginVersionCommandHandler,
	RenewPluginSubscriptionCommandHandler,
	SetPluginSettingValueHandler,
	UninstallPluginCommandHandler,
	UpdatePluginCategoryHandler,
	UpdatePluginCommandHandler,
	UpdatePluginSettingHandler,
	UpdatePluginSubscriptionCommandHandler,
	UpdatePluginVersionCommandHandler,
	VerifyPluginCommandHandler
};

// Export commands handlers array
export const commands = [
	// Plugin Management Command Handlers
	ActivatePluginCommandHandler,
	CreatePluginCommandHandler,
	DeactivatePluginCommandHandler,
	DeletePluginCommandHandler,
	InstallPluginCommandHandler,
	UninstallPluginCommandHandler,
	UpdatePluginCommandHandler,
	VerifyPluginCommandHandler,

	// Plugin Version Command Handlers
	CreatePluginVersionCommandHandler,
	DeletePluginVersionCommandHandler,
	RecoverPluginVersionCommandHandler,
	UpdatePluginVersionCommandHandler,

	// Plugin Source Command Handlers
	CreatePluginSourceCommandHandler,
	DeletePluginSourceCommandHandler,
	RecoverPluginSourceCommandHandler,

	// Plugin Category Command Handlers
	CreatePluginCategoryHandler,
	DeletePluginCategoryHandler,
	UpdatePluginCategoryHandler,

	// Plugin Subscription Command Handlers
	CancelPluginSubscriptionCommandHandler,
	CreatePluginSubscriptionCommandHandler,
	DeletePluginSubscriptionCommandHandler,
	ProcessBillingCommandHandler,
	PurchasePluginSubscriptionCommandHandler,
	RenewPluginSubscriptionCommandHandler,
	UpdatePluginSubscriptionCommandHandler,

	// Plugin Settings Command Handlers
	BulkUpdatePluginSettingsHandler,
	CreatePluginSettingHandler,
	DeletePluginSettingHandler,
	SetPluginSettingValueHandler,
	UpdatePluginSettingHandler,

	// Plugin Configuration Command Handlers
	PluginConfigGetHandler,
	PluginConfigSetHandler,
	PluginInstallHandler,
	PluginUninstallHandler
];
