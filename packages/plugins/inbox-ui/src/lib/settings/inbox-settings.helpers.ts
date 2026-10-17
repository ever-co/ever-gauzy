import { HttpErrorResponse } from '@angular/common/http';
import { IEmailProviderDescriptor, IInboxProviderAccountCreated } from '@gauzy/contracts';
import { providerConfigFields } from './provider-config-form.helpers';

/** One value shown once: its label (a provider field's own, or a translation key) and the value. */
export interface IInboxOneTimeValue {
	label: string;
	/** `label` is a translation key of the plugin's namespace (else the provider's own words). */
	translate?: boolean;
	value: string;
}

/** What a settings page shows. */
export type InboxSettingsView = 'loading' | 'ready' | 'unavailable' | 'forbidden' | 'error';

/** The view an API failure of a page's first load leads to: 404 = the email features are off; 403 = not for me. */
export function viewOfLoadError(error: unknown): InboxSettingsView {
	const status = (error as HttpErrorResponse)?.status;
	if (status === 404) return 'unavailable';
	if (status === 403 || status === 401) return 'forbidden';
	return 'error';
}

/** The message of an API refusal (`message` of the Nest error body, joined when it is a list), or `null`. */
export function apiErrorMessage(error: unknown): string | null {
	const body = (error as HttpErrorResponse)?.error;
	const message = body?.message ?? null;
	if (Array.isArray(message)) return message.filter((part) => typeof part === 'string').join(' ') || null;
	return typeof message === 'string' && message.trim() ? message.trim() : null;
}

/** The form field an API refusal names (`{ message, field }` of a refused provider configuration), or `null`. */
export function apiErrorField(error: unknown): string | null {
	const field = (error as HttpErrorResponse)?.error?.field;
	return typeof field === 'string' && field ? field : null;
}

/**
 * The values a create or a rotation answered once (`oneTimeSecrets`, `oneTimeWebhookUrl`), labelled with the
 * provider's own field titles; empty when there are none.
 */
export function oneTimeValuesOf(
	created: Pick<IInboxProviderAccountCreated, 'oneTimeSecrets' | 'oneTimeWebhookUrl'> | null | undefined,
	provider?: IEmailProviderDescriptor | null
): IInboxOneTimeValue[] {
	const labels = new Map(providerConfigFields(provider?.configSchema).map((field) => [field.name, field.label]));
	const values: IInboxOneTimeValue[] = Object.entries(created?.oneTimeSecrets ?? {})
		.filter(([, value]) => typeof value === 'string' && value !== '')
		.map(([name, value]) => ({ label: labels.get(name) ?? name, value }));
	if (created?.oneTimeWebhookUrl) {
		values.push({
			label: 'INBOX.SETTINGS.PROVIDERS.WEBHOOK_URL',
			translate: true,
			value: created.oneTimeWebhookUrl
		});
	}
	return values;
}
