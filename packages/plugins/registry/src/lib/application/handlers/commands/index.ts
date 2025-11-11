// Plugin Management Command Handlers
import { ActivatePluginCommandHandler } from './activate-plugin-command.handler';
import { CreatePluginCommandHandler } from './create-plugin-command.handler';
import { DeactivatePluginCommandHandler } from './deactivate-plugin-command.handler';
import { DeletePluginCommandHandler } from './delete-plugin-command.handler';
import { InstallPluginCommandHandler } from './install-plugin-command.handler';
import { UninstallPluginCommandHandler } from './uninstall-plugin-command.handler';
import { UpdatePluginCommandHandler } from './update-plugin-command.handler';
import { VerifyPluginCommandHandler } from './verify-plugin-command.handler';

// Plugin User Assignment Command Handlers
import {
	AssignUsersToPluginCommandHandler,
	BulkAssignUsersToPluginsCommandHandler,
	UnassignUsersFromPluginCommandHandler
} from './plugin-user-assignment-command.handlers';

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
import { AssignPluginSubscriptionUsersCommandHandler } from './assign-plugin-subscription-users.handler';
import { CancelPluginSubscriptionCommandHandler } from './cancel-plugin-subscription.handler';
import { CreatePluginSubscriptionCommandHandler } from './create-plugin-subscription.handler';
import { DeletePluginSubscriptionCommandHandler } from './delete-plugin-subscription.handler';
import { DowngradePluginSubscriptionCommandHandler } from './downgrade-plugin-subscription.handler';
import { ExtendTrialSubscriptionCommandHandler } from './extend-trial-subscription.handler';
import { PluginBillingCreateHandler } from './plugin-billing-create.handler';
import { PluginBillingProcessPaymentHandler } from './plugin-billing-process-payment.handler';
import { ProcessBillingCommandHandler } from './process-billing.handler';
import { PurchasePluginSubscriptionCommandHandler } from './purchase-plugin-subscription.handler';
import { RenewPluginSubscriptionCommandHandler } from './renew-plugin-subscription.handler';
import { RevokePluginSubscriptionUsersCommandHandler } from './revoke-plugin-subscription-users.handler';
import { UpdatePluginSubscriptionCommandHandler } from './update-plugin-subscription.handler';
import { UpgradePluginSubscriptionCommandHandler } from './upgrade-plugin-subscription.handler';

// Plugin Subscription Plan Command Handlers
import { BulkPluginPlanOperationCommandHandler } from './bulk-plugin-plan-operation.handler';
import { CopyPluginPlanCommandHandler } from './copy-plugin-plan.handler';
import { CreatePluginSubscriptionPlanCommandHandler } from './create-plugin-subscription-plan.handler';
import { DeletePluginSubscriptionPlanCommandHandler } from './delete-plugin-subscription-plan.handler';
import { UpdatePluginSubscriptionPlanCommandHandler } from './update-plugin-subscription-plan.handler';

// Plugin Settings Command Handlers
import { BulkUpdatePluginSettingsHandler } from './bulk-update-plugin-settings.handler';
import { CreatePluginSettingHandler } from './create-plugin-setting.handler';
import { DeletePluginSettingHandler } from './delete-plugin-setting.handler';
import { SetPluginSettingValueHandler } from './set-plugin-setting-value.handler';
import { UpdatePluginSettingHandler } from './update-plugin-setting.handler';

// Plugin Configuration Command Handlers
import { PluginConfigGetHandler } from './plugin-config-get.handler';
import { PluginConfigSetHandler } from './plugin-config-set.handler';

// Plugin Tag Command Handlers
import { AutoTagPluginHandler } from './plugin-tag/auto-tag-plugin.handler';
import { BulkCreatePluginTagsHandler } from './plugin-tag/bulk-create-plugin-tags.handler';
import { CreatePluginTagHandler } from './plugin-tag/create-plugin-tag.handler';
import {
	BulkDeletePluginTagsHandler,
	DeletePluginTagHandler,
	ReplacePluginTagsHandler
} from './plugin-tag/delete-plugin-tag.handler';
import {
	BulkUpdatePluginTagsHandler,
	UpdatePluginTagHandler,
	UpdatePluginTagsPriorityHandler
} from './plugin-tag/update-plugin-tag.handler';

// Export individual handlers
export {
	// Plugin Management Command Handlers
	ActivatePluginCommandHandler,
	// Plugin Subscription Access Command Handlers
	AssignPluginSubscriptionUsersCommandHandler,
	// Plugin User Assignment Command Handlers
	AssignUsersToPluginCommandHandler,
	// Plugin Tag Command Handlers
	AutoTagPluginHandler,
	BulkAssignUsersToPluginsCommandHandler,
	BulkCreatePluginTagsHandler,
	BulkDeletePluginTagsHandler,
	// Plugin Subscription Plan Command Handlers
	BulkPluginPlanOperationCommandHandler,
	// Plugin Settings Command Handlers
	BulkUpdatePluginSettingsHandler,
	BulkUpdatePluginTagsHandler,
	// Plugin Subscription Command Handlers
	CancelPluginSubscriptionCommandHandler,
	CopyPluginPlanCommandHandler,
	// Plugin Category Command Handlers
	CreatePluginCategoryHandler,
	CreatePluginCommandHandler,
	CreatePluginSettingHandler,
	// Plugin Source Command Handlers
	CreatePluginSourceCommandHandler,
	CreatePluginSubscriptionCommandHandler,
	CreatePluginSubscriptionPlanCommandHandler,
	CreatePluginTagHandler,
	// Plugin Version Command Handlers
	CreatePluginVersionCommandHandler,
	DeactivatePluginCommandHandler,
	DeletePluginCategoryHandler,
	DeletePluginCommandHandler,
	DeletePluginSettingHandler,
	DeletePluginSourceCommandHandler,
	DeletePluginSubscriptionCommandHandler,
	DeletePluginSubscriptionPlanCommandHandler,
	DeletePluginTagHandler,
	DeletePluginVersionCommandHandler,
	InstallPluginCommandHandler,
	// Plugin Billing Command Handlers
	PluginBillingCreateHandler,
	PluginBillingProcessPaymentHandler,
	// Plugin Configuration Command Handlers
	PluginConfigGetHandler,
	PluginConfigSetHandler,
	ProcessBillingCommandHandler,
	PurchasePluginSubscriptionCommandHandler,
	RecoverPluginSourceCommandHandler,
	RecoverPluginVersionCommandHandler,
	RenewPluginSubscriptionCommandHandler,
	ReplacePluginTagsHandler,
	RevokePluginSubscriptionUsersCommandHandler,
	SetPluginSettingValueHandler,
	UnassignUsersFromPluginCommandHandler,
	UninstallPluginCommandHandler,
	UpdatePluginCategoryHandler,
	UpdatePluginCommandHandler,
	UpdatePluginSettingHandler,
	UpdatePluginSubscriptionCommandHandler,
	UpdatePluginSubscriptionPlanCommandHandler,
	UpdatePluginTagHandler,
	UpdatePluginTagsPriorityHandler,
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

	// Plugin User Assignment Command Handlers
	AssignUsersToPluginCommandHandler,
	UnassignUsersFromPluginCommandHandler,
	BulkAssignUsersToPluginsCommandHandler,

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
	AssignPluginSubscriptionUsersCommandHandler,
	CancelPluginSubscriptionCommandHandler,
	CreatePluginSubscriptionCommandHandler,
	DeletePluginSubscriptionCommandHandler,
	DowngradePluginSubscriptionCommandHandler,
	ExtendTrialSubscriptionCommandHandler,
	PluginBillingCreateHandler,
	PluginBillingProcessPaymentHandler,
	ProcessBillingCommandHandler,
	PurchasePluginSubscriptionCommandHandler,
	RenewPluginSubscriptionCommandHandler,
	RevokePluginSubscriptionUsersCommandHandler,
	UpdatePluginSubscriptionCommandHandler,
	UpgradePluginSubscriptionCommandHandler,

	// Plugin Subscription Plan Command Handlers
	BulkPluginPlanOperationCommandHandler,
	CopyPluginPlanCommandHandler,
	CreatePluginSubscriptionPlanCommandHandler,
	DeletePluginSubscriptionPlanCommandHandler,
	UpdatePluginSubscriptionPlanCommandHandler,

	// Plugin Settings Command Handlers
	BulkUpdatePluginSettingsHandler,
	CreatePluginSettingHandler,
	DeletePluginSettingHandler,
	SetPluginSettingValueHandler,
	UpdatePluginSettingHandler,

	// Plugin Configuration Command Handlers
	PluginConfigGetHandler,
	PluginConfigSetHandler,

	// Plugin Tag Command Handlers
	AutoTagPluginHandler,
	BulkCreatePluginTagsHandler,
	BulkDeletePluginTagsHandler,
	BulkUpdatePluginTagsHandler,
	CreatePluginTagHandler,
	DeletePluginTagHandler,
	ReplacePluginTagsHandler,
	UpdatePluginTagHandler,
	UpdatePluginTagsPriorityHandler
];
