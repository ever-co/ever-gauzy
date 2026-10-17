import {
	IEmailProviderConfigProperty,
	IEmailProviderConfigSchema,
	IEmailProviderDescriptor,
	IInboxProviderAccount
} from '@gauzy/contracts';

/**
 * The generic provider-account form (Settings → Inbox → Providers, G-P4-2): a provider plugin's `configSchema` (the
 * JSON Schema subset of `IEmailProviderConfigProperty`) turned into fields, the form's state, its checks and the
 * `config` the API takes. Pure functions, so the rules are tested without a browser.
 *
 * Secrets (`writeOnly`, `generated`) are write-only: the form never holds a stored value (the API answers only which are
 * set, `secretsSet`). Left empty, a stored secret is kept; typed, it is replaced; marked for reset, it is sent as `null`
 * (a `writeOnly` one is cleared, a `generated` one is generated anew by the server and shown once).
 */

/** How a field is rendered. */
export type ProviderConfigControl = 'text' | 'textarea' | 'secret' | 'generated' | 'number' | 'boolean' | 'enum';

/** One field of the form. */
export interface IProviderConfigField {
	name: string;
	property: IEmailProviderConfigProperty;
	control: ProviderConfigControl;
	/** The `<input type>` of a text, number or secret field. */
	inputType: 'text' | 'email' | 'url' | 'password' | 'number';
	/** The plugin's label (`title`, else the field name) and help text: the provider's own words, not translated. */
	label: string;
	description: string | null;
	required: boolean;
	/** `writeOnly` or `generated`: stored encrypted, never answered. */
	secret: boolean;
	options: Array<string | number>;
}

/** The form's state: the values typed, and the secret fields to reset (sent as `null`). */
export interface IProviderConfigFormState {
	values: Record<string, string | number | boolean | null>;
	reset: string[];
}

/** A field's problem: a translation key of the plugin's namespace, and its parameters. */
export interface IProviderConfigError {
	key: string;
	params?: Record<string, string | number>;
}

const EMAIL_PATTERN = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/;
const HOSTNAME_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/** The longest string a field takes when its schema states no `maxLength` (the API's `PROVIDER_CONFIG_MAX_STRING`). */
export const PROVIDER_CONFIG_MAX_STRING = 8192;

export const PROVIDER_CONFIG_ERROR_KEYS = {
	REQUIRED: 'INBOX.SETTINGS.FORM.ERRORS.REQUIRED',
	NUMBER: 'INBOX.SETTINGS.FORM.ERRORS.NUMBER',
	INTEGER: 'INBOX.SETTINGS.FORM.ERRORS.INTEGER',
	MIN: 'INBOX.SETTINGS.FORM.ERRORS.MIN',
	MAX: 'INBOX.SETTINGS.FORM.ERRORS.MAX',
	MIN_LENGTH: 'INBOX.SETTINGS.FORM.ERRORS.MIN_LENGTH',
	MAX_LENGTH: 'INBOX.SETTINGS.FORM.ERRORS.MAX_LENGTH',
	PATTERN: 'INBOX.SETTINGS.FORM.ERRORS.PATTERN',
	EMAIL: 'INBOX.SETTINGS.FORM.ERRORS.EMAIL',
	HOSTNAME: 'INBOX.SETTINGS.FORM.ERRORS.HOSTNAME',
	URL: 'INBOX.SETTINGS.FORM.ERRORS.URL',
	SINGLE_LINE: 'INBOX.SETTINGS.FORM.ERRORS.SINGLE_LINE',
	OPTION: 'INBOX.SETTINGS.FORM.ERRORS.OPTION',
	UNSUPPORTED: 'INBOX.SETTINGS.FORM.ERRORS.UNSUPPORTED'
} as const;

function controlOf(property: IEmailProviderConfigProperty): ProviderConfigControl {
	if (property.generated === true) return 'generated';
	if (property.writeOnly === true) return 'secret';
	if (property.type === 'boolean') return 'boolean';
	if (Array.isArray(property.enum) && property.enum.length > 0) return 'enum';
	if (property.type === 'number' || property.type === 'integer') return 'number';
	if (property.format === 'textarea') return 'textarea';
	return 'text';
}

function inputTypeOf(property: IEmailProviderConfigProperty, control: ProviderConfigControl) {
	if (control === 'secret' || control === 'generated') return 'password' as const;
	if (control === 'number') return 'number' as const;
	if (property.format === 'email') return 'email' as const;
	if (property.format === 'uri') return 'url' as const;
	return 'text' as const;
}

/** The fields of a form, in the schema's order. A schema without properties has none. */
export function providerConfigFields(schema: IEmailProviderConfigSchema | null | undefined): IProviderConfigField[] {
	const required = new Set(schema?.required ?? []);
	return Object.entries(schema?.properties ?? {}).map(([name, property]) => {
		const control = controlOf(property);
		return {
			name,
			property,
			control,
			inputType: inputTypeOf(property, control),
			label: property.title?.trim() || name,
			description: property.description?.trim() || null,
			required: required.has(name),
			secret: control === 'secret' || control === 'generated',
			options: control === 'enum' ? [...(property.enum ?? [])] : []
		};
	});
}

/** The value a public field starts with: the account's stored one, else (a new account) the schema's default. */
function startValue(
	field: IProviderConfigField,
	account?: IInboxProviderAccount | null
): string | number | boolean | null {
	const stored = account ? account.config?.[field.name] : field.property.default;
	switch (field.control) {
		case 'boolean':
			return stored === true;
		case 'enum':
			return stored === undefined || stored === null || stored === '' ? null : (stored as string | number);
		case 'number':
			return typeof stored === 'number' && Number.isFinite(stored) ? String(stored) : '';
		default:
			return typeof stored === 'string' || typeof stored === 'number' ? String(stored) : '';
	}
}

/**
 * The state a form starts with. Public fields carry the account's values (a new account: the defaults); secret fields
 * start empty, always: a stored secret is never put back into a form.
 */
export function initialProviderConfigState(
	schema: IEmailProviderConfigSchema | null | undefined,
	account?: IInboxProviderAccount | null
): IProviderConfigFormState {
	const values: IProviderConfigFormState['values'] = {};
	for (const field of providerConfigFields(schema)) {
		values[field.name] = field.secret ? '' : startValue(field, account);
	}
	return { values, reset: [] };
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/** Whether the account has a stored value for a secret field. */
export function isSecretSet(account: IInboxProviderAccount | null | undefined, name: string): boolean {
	return !!account?.secretsSet?.includes(name);
}

/** One field's problem, or `null`. `account` is the stored account of an edit (a stored secret counts as a value). */
export function providerConfigFieldError(
	field: IProviderConfigField,
	state: IProviderConfigFormState,
	account?: IInboxProviderAccount | null
): IProviderConfigError | null {
	const value = state.values[field.name];
	const property = field.property;

	if (field.control === 'generated') {
		// The server generates it when it has no value: the user never has to type one.
		return null;
	}
	if (field.control === 'secret') {
		const resetting = state.reset.includes(field.name);
		const typed = !isEmpty(value);
		if (field.required && (resetting || (!typed && !isSecretSet(account, field.name)))) {
			return { key: PROVIDER_CONFIG_ERROR_KEYS.REQUIRED };
		}
		return typed ? textError(String(value), property) : null;
	}
	if (field.control === 'boolean') {
		return null;
	}
	if (isEmpty(value)) {
		return field.required ? { key: PROVIDER_CONFIG_ERROR_KEYS.REQUIRED } : null;
	}
	if (field.control === 'enum') {
		return field.options.some((option) => String(option) === String(value))
			? null
			: { key: PROVIDER_CONFIG_ERROR_KEYS.OPTION };
	}
	if (field.control === 'number') {
		const number = Number(value);
		if (!Number.isFinite(number)) return { key: PROVIDER_CONFIG_ERROR_KEYS.NUMBER };
		if (property.type === 'integer' && !Number.isInteger(number))
			return { key: PROVIDER_CONFIG_ERROR_KEYS.INTEGER };
		if (property.minimum !== undefined && number < property.minimum) {
			return { key: PROVIDER_CONFIG_ERROR_KEYS.MIN, params: { min: property.minimum } };
		}
		if (property.maximum !== undefined && number > property.maximum) {
			return { key: PROVIDER_CONFIG_ERROR_KEYS.MAX, params: { max: property.maximum } };
		}
		return null;
	}
	if (property.type !== 'string') {
		return { key: PROVIDER_CONFIG_ERROR_KEYS.UNSUPPORTED };
	}
	return textError(String(value), property);
}

/** The checks of a text value (the API's own, so a refusal is rare). */
function textError(raw: string, property: IEmailProviderConfigProperty): IProviderConfigError | null {
	const text = raw.trim();
	if (property.format !== 'textarea' && /[\r\n]/.test(text)) return { key: PROVIDER_CONFIG_ERROR_KEYS.SINGLE_LINE };
	const max = property.maxLength ?? PROVIDER_CONFIG_MAX_STRING;
	if (text.length > max) return { key: PROVIDER_CONFIG_ERROR_KEYS.MAX_LENGTH, params: { max } };
	if (property.minLength !== undefined && text.length < property.minLength) {
		return { key: PROVIDER_CONFIG_ERROR_KEYS.MIN_LENGTH, params: { min: property.minLength } };
	}
	if (property.pattern) {
		let pattern: RegExp | null = null;
		try {
			pattern = new RegExp(property.pattern);
		} catch {
			// A pattern this browser cannot read: the API checks it.
		}
		if (pattern && !pattern.test(text)) return { key: PROVIDER_CONFIG_ERROR_KEYS.PATTERN };
	}
	if (property.format === 'email' && !EMAIL_PATTERN.test(text)) return { key: PROVIDER_CONFIG_ERROR_KEYS.EMAIL };
	if (property.format === 'hostname' && !HOSTNAME_PATTERN.test(text))
		return { key: PROVIDER_CONFIG_ERROR_KEYS.HOSTNAME };
	if (property.format === 'uri') {
		try {
			if (new URL(text).protocol !== 'https:') return { key: PROVIDER_CONFIG_ERROR_KEYS.URL };
		} catch {
			return { key: PROVIDER_CONFIG_ERROR_KEYS.URL };
		}
	}
	return null;
}

/** Every field's problem, by field name (empty: the form can be sent). */
export function providerConfigErrors(
	schema: IEmailProviderConfigSchema | null | undefined,
	state: IProviderConfigFormState,
	account?: IInboxProviderAccount | null
): Record<string, IProviderConfigError> {
	const errors: Record<string, IProviderConfigError> = {};
	for (const field of providerConfigFields(schema)) {
		const error = providerConfigFieldError(field, state, account);
		if (error) errors[field.name] = error;
	}
	return errors;
}

/**
 * The `config` of a create or an update (`account`: the stored account of an edit).
 *
 * - Public field: its value (a number field as a number); an emptied field is cleared (`null`) on an edit where it had
 *   a value, and left out otherwise.
 * - Secret field: a typed value replaces it; left empty, it is left out (the stored value stays); marked for reset, it
 *   is sent as `null` (cleared, or for a `generated` one, generated anew).
 */
export function providerConfigPayload(
	schema: IEmailProviderConfigSchema | null | undefined,
	state: IProviderConfigFormState,
	account?: IInboxProviderAccount | null
): Record<string, unknown> {
	const config: Record<string, unknown> = {};
	for (const field of providerConfigFields(schema)) {
		const value = state.values[field.name];
		if (field.secret) {
			if (account && state.reset.includes(field.name)) config[field.name] = null;
			else if (field.control === 'secret' && !isEmpty(value)) config[field.name] = String(value);
			continue;
		}
		if (field.control === 'boolean') {
			config[field.name] = value === true;
			continue;
		}
		if (isEmpty(value)) {
			const stored = account?.config?.[field.name];
			if (account && stored !== undefined && stored !== null && stored !== '') config[field.name] = null;
			continue;
		}
		if (field.control === 'number') {
			config[field.name] = Number(value);
		} else if (field.control === 'enum') {
			// The option itself (a number enum stays a number).
			config[field.name] = field.options.find((option) => String(option) === String(value)) ?? value;
		} else {
			config[field.name] = String(value).trim();
		}
	}
	return config;
}

/** A provider's capabilities as an account shows them: the account's recorded ones, else the provider's. */
export function capabilitiesOf(
	account: IInboxProviderAccount,
	provider?: IEmailProviderDescriptor | null
): IEmailProviderDescriptor['capabilities'] | null {
	return account.capabilities ?? provider?.capabilities ?? null;
}
