import { PluginBillingCreatedHandler } from './plugin-billing-created.handler';
import { PluginBillingFailedHandler } from './plugin-billing-failed.handler';
import { PluginBillingOverdueHandler } from './plugin-billing-overdue.handler';
import { PluginBillingPaidHandler } from './plugin-billing-paid.handler';

export const eventHandlers = [
	PluginBillingCreatedHandler,
	PluginBillingPaidHandler,
	PluginBillingFailedHandler,
	PluginBillingOverdueHandler
];

export * from './plugin-billing-created.handler';
export * from './plugin-billing-failed.handler';
export * from './plugin-billing-overdue.handler';
export * from './plugin-billing-paid.handler';
