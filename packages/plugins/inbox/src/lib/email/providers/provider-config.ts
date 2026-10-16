import { randomBytes } from 'node:crypto';
import { IEmailProviderConfigProperty, IEmailProviderConfigSchema } from '@gauzy/contracts';

/** A configuration value refused by the provider's form, with the field it is about. */
export class ProviderConfigError extends Error {
	constructor(
		readonly field: string,
		message: string
	) {
		super(message);
		this.name = 'ProviderConfigError';
	}
}

/** The two halves a provider account's configuration is stored as. */
export interface ISplitProviderConfig {
	/** Non-secret fields, stored as plain JSON and answered by the API. */
	config: Record<string, unknown>;
	/** Secret fields (`writeOnly` / `generated`), stored encrypted and never answered. */
	secrets: Record<string, string>;
	/** The secrets the server generated in this call (to be shown once). */
	generated: Record<string, string>;
}

/** The longest string a field takes when its schema states no `maxLength` (a PEM public key fits). */
export const PROVIDER_CONFIG_MAX_STRING = 8192;

const EMAIL_PATTERN = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/;
const HOSTNAME_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/** Whether a field is a secret (stored encrypted, never answered). */
export function isSecretField(property: IEmailProviderConfigProperty): boolean {
	return property.writeOnly === true || property.generated === true;
}

/** The secret fields of a form. */
export function secretFields(schema: IEmailProviderConfigSchema): string[] {
	return Object.entries(schema.properties)
		.filter(([, property]) => isSecretField(property))
		.map(([name]) => name);
}

/** A new random secret for a `generated` field (256 bits, URL-safe). */
export function generateProviderSecret(): string {
	return randomBytes(32).toString('base64url');
}

/** One value checked and normalized against its field. Throws {@link ProviderConfigError}. */
function normalizeValue(name: string, property: IEmailProviderConfigProperty, value: unknown): unknown {
	const label = property.title || name;
	switch (property.type) {
		case 'boolean':
			if (typeof value !== 'boolean') throw new ProviderConfigError(name, `${label} must be true or false.`);
			return value;
		case 'number':
		case 'integer': {
			const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
			if (typeof number !== 'number' || !Number.isFinite(number)) {
				throw new ProviderConfigError(name, `${label} must be a number.`);
			}
			if (property.type === 'integer' && !Number.isInteger(number)) {
				throw new ProviderConfigError(name, `${label} must be a whole number.`);
			}
			if (property.minimum !== undefined && number < property.minimum) {
				throw new ProviderConfigError(name, `${label} must be at least ${property.minimum}.`);
			}
			if (property.maximum !== undefined && number > property.maximum) {
				throw new ProviderConfigError(name, `${label} must be at most ${property.maximum}.`);
			}
			if (property.enum && !property.enum.includes(number)) {
				throw new ProviderConfigError(name, `${label} is not one of the allowed values.`);
			}
			return number;
		}
		case 'string': {
			if (typeof value !== 'string') throw new ProviderConfigError(name, `${label} must be text.`);
			// A multi-line value (a PEM key) keeps its inner lines; any other value is one line.
			const text = value.trim();
			if (property.format !== 'textarea' && /[\r\n]/.test(text)) {
				throw new ProviderConfigError(name, `${label} must be a single line.`);
			}
			const max = property.maxLength ?? PROVIDER_CONFIG_MAX_STRING;
			if (text.length > max) throw new ProviderConfigError(name, `${label} is at most ${max} characters.`);
			if (property.minLength !== undefined && text.length < property.minLength) {
				throw new ProviderConfigError(name, `${label} is at least ${property.minLength} characters.`);
			}
			if (property.enum && !property.enum.includes(text)) {
				throw new ProviderConfigError(name, `${label} is not one of the allowed values.`);
			}
			if (property.pattern && !new RegExp(property.pattern).test(text)) {
				throw new ProviderConfigError(name, `${label} is not in the expected format.`);
			}
			if (property.format === 'email' && !EMAIL_PATTERN.test(text)) {
				throw new ProviderConfigError(name, `${label} must be an email address.`);
			}
			if (property.format === 'hostname' && !HOSTNAME_PATTERN.test(text)) {
				throw new ProviderConfigError(name, `${label} must be a host name.`);
			}
			if (property.format === 'uri') {
				let url: URL;
				try {
					url = new URL(text);
				} catch {
					throw new ProviderConfigError(name, `${label} must be a URL.`);
				}
				if (url.protocol !== 'https:') throw new ProviderConfigError(name, `${label} must be an https URL.`);
			}
			return text;
		}
		default:
			throw new ProviderConfigError(name, `${label} has a type this form does not support.`);
	}
}

/**
 * Checks a configuration against the provider's form and splits it into its public and secret halves, merged
 * over the stored ones (`previous`) on an update.
 *
 * - A field the form does not have is refused.
 * - Public field: a value replaces the stored one; `null` (or `''`) clears it; left out, it stays.
 * - Secret field: a value replaces the stored one; `null` clears it; left out or `''`, it stays (the form never
 *   holds the stored secret, so it sends nothing for an unchanged one).
 * - A `generated` secret without a value gets a new random one (reported in `generated`, which the API answers
 *   once): on create, and on an update that clears it with `null` (a rotation).
 * - A `default` fills a public field that has no value on create.
 * - Every `required` field must have a value afterwards (a stored secret counts).
 */
export function splitProviderConfig(
	schema: IEmailProviderConfigSchema,
	input: Record<string, unknown> | null | undefined,
	previous?: { config: Record<string, unknown>; secrets: Record<string, string> }
): ISplitProviderConfig {
	if (input !== null && input !== undefined && (typeof input !== 'object' || Array.isArray(input))) {
		throw new ProviderConfigError('config', 'The configuration must be an object.');
	}
	const stated = input ?? {};
	const properties = schema.properties ?? {};
	for (const name of Object.keys(stated)) {
		if (!Object.prototype.hasOwnProperty.call(properties, name)) {
			throw new ProviderConfigError(name, `This provider has no setting named ${name}.`);
		}
	}

	const config: Record<string, unknown> = { ...(previous?.config ?? {}) };
	const secrets: Record<string, string> = { ...(previous?.secrets ?? {}) };
	const generated: Record<string, string> = {};

	for (const [name, property] of Object.entries(properties)) {
		const has = Object.prototype.hasOwnProperty.call(stated, name);
		const value = has ? stated[name] : undefined;
		if (isSecretField(property)) {
			if (value === null) {
				delete secrets[name];
			} else if (value !== undefined && value !== '') {
				secrets[name] = normalizeValue(name, { ...property, type: 'string' }, value) as string;
			}
			if (property.generated && !secrets[name]) {
				secrets[name] = generateProviderSecret();
				generated[name] = secrets[name];
			}
			// A secret never sits in the public half.
			delete config[name];
			continue;
		}
		if (has) {
			if (value === null || value === '') {
				delete config[name];
			} else {
				config[name] = normalizeValue(name, property, value);
			}
		} else if (!previous && property.default !== undefined && config[name] === undefined) {
			config[name] = property.default;
		}
	}

	for (const name of schema.required ?? []) {
		const property = properties[name];
		const present = property && isSecretField(property) ? !!secrets[name] : config[name] !== undefined;
		if (!present) {
			throw new ProviderConfigError(name, `${property?.title || name} is required.`);
		}
	}
	return { config, secrets, generated };
}
