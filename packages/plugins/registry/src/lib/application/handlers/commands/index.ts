// Plugin Management Command Handlers
export * from './activate-plugin-command.handler';
export * from './create-plugin-command.handler';
export * from './deactivate-plugin-command.handler';
export * from './delete-plugin-command.handler';
export * from './install-plugin-command.handler';
export * from './uninstall-plugin-command.handler';
export * from './update-plugin-command.handler';
export * from './verify-plugin-command.handler';

// Plugin Version Command Handlers
export * from './create-plugin-version-command.handler';
export * from './delete-plugin-version-command.handler';
export * from './recover-plugin-version-command.handler';
export * from './update-plugin-version-command.handler';

// Plugin Source Command Handlers
export * from './create-plugin-source-command.handler';
export * from './delete-plugin-source-command.handler';
export * from './recover-plugin-source-command.handler';

// Plugin Category Command Handlers
export * from './create-plugin-category.handler';
export * from './delete-plugin-category.handler';
export * from './update-plugin-category.handler';

// Plugin Subscription Command Handlers
export * from './cancel-plugin-subscription.handler';
export * from './create-plugin-subscription.handler';
export * from './delete-plugin-subscription.handler';
export * from './process-billing.handler';
export * from './purchase-plugin-subscription.handler';
export * from './renew-plugin-subscription.handler';
export * from './update-plugin-subscription.handler';

// Plugin Settings Command Handlers
export * from './bulk-update-plugin-settings.handler';
export * from './create-plugin-setting.handler';
export * from './delete-plugin-setting.handler';
export * from './set-plugin-setting-value.handler';
export * from './update-plugin-setting.handler';

// Plugin Configuration Command Handlers
export * from './plugin-config-get.handler';
export * from './plugin-config-set.handler';
export * from './plugin-install.handler';
export * from './plugin-uninstall.handler';

// Export existing commands array placeholder
export const commands = [];
