import {
	ID,
	IInboxMailbox,
	IInboxMailboxCreateInput,
	IInboxMailboxUpdateInput,
	IInboxProviderAccount,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxMailboxOwnerTypeEnum,
	InboxProviderAccountStatusEnum
} from '@gauzy/contracts';

/**
 * Settings → Inbox → Mailboxes (G-P4-1): the rules of the mailbox forms, as pure functions — the same checks as the
 * API's (`mailbox-address.ts`, `InboxMailboxService`), so a refusal is rare and the tests need no browser.
 */

/** The mailbox setting naming the Ever Works agent its mail is handed to (G-P4-6, `integration-ever-works`). */
export const EVER_WORKS_AGENT_SETTING = 'everWorksAgentId';

/** The sender allowlist's limit (the API's). */
export const MAILBOX_ALLOWLIST_MAX = 200;
export const MAILBOX_DISPLAY_NAME_MAX = 200;
export const MAILBOX_LOCAL_PART_MAX = 64;

/** The kinds a mailbox can be created as (CONNECTED comes with P5). */
export type InboxMailboxCreateKind =
	InboxMailboxKindEnum.PLATFORM | InboxMailboxKindEnum.CUSTOM_DOMAIN | InboxMailboxKindEnum.FORWARDING;

export const MAILBOX_CREATE_KINDS: InboxMailboxCreateKind[] = [
	InboxMailboxKindEnum.PLATFORM,
	InboxMailboxKindEnum.CUSTOM_DOMAIN,
	InboxMailboxKindEnum.FORWARDING
];

const LOCAL_PART = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const DOMAIN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const ADDRESS = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/;

export const MAILBOX_ERROR_KEYS = {
	REQUIRED: 'INBOX.SETTINGS.FORM.ERRORS.REQUIRED',
	LOCAL_PART: 'INBOX.SETTINGS.MAILBOXES.ERRORS.LOCAL_PART',
	DOMAIN: 'INBOX.SETTINGS.MAILBOXES.ERRORS.DOMAIN',
	RESERVED_DOMAIN: 'INBOX.SETTINGS.MAILBOXES.ERRORS.RESERVED_DOMAIN',
	ADDRESS: 'INBOX.SETTINGS.FORM.ERRORS.EMAIL',
	ALLOWLIST: 'INBOX.SETTINGS.MAILBOXES.ERRORS.ALLOWLIST',
	ALLOWLIST_MAX: 'INBOX.SETTINGS.MAILBOXES.ERRORS.ALLOWLIST_MAX',
	NO_PLATFORM_DOMAIN: 'INBOX.SETTINGS.MAILBOXES.ERRORS.NO_PLATFORM_DOMAIN',
	MAX_LENGTH: 'INBOX.SETTINGS.FORM.ERRORS.MAX_LENGTH'
} as const;

export interface IMailboxFormError {
	key: string;
	params?: Record<string, string | number>;
}

/** The fields of the "Add mailbox" form. */
export interface IMailboxCreateFormState {
	ownerType: InboxMailboxOwnerTypeEnum;
	ownerEmployeeId: ID | null;
	ownerTeamId: ID | null;
	kind: InboxMailboxCreateKind;
	/** The name part of a platform address (optional), or the local part of a custom-domain address (required). */
	localPart: string;
	domain: string;
	providerAccountId: ID | null;
	/** FORWARDING: the existing address that forwards here (shown in the instructions). */
	forwardFrom: string;
	displayName: string;
	/** One entry per line (or comma separated): an address, or `@domain`. */
	allowlist: string;
	isDefault: boolean;
}

export function emptyMailboxCreateForm(platformDomain: string | null | undefined): IMailboxCreateFormState {
	return {
		ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
		ownerEmployeeId: null,
		ownerTeamId: null,
		// Without a platform domain only a custom-domain mailbox can be created.
		kind: platformDomain ? InboxMailboxKindEnum.PLATFORM : InboxMailboxKindEnum.CUSTOM_DOMAIN,
		localPart: '',
		domain: '',
		providerAccountId: null,
		forwardFrom: '',
		displayName: '',
		allowlist: '',
		isDefault: false
	};
}

/** The allowlist entries of a text: lower-case, trimmed, each once, in the order typed. */
export function parseAllowlist(text: string | null | undefined): string[] {
	return [
		...new Set(
			String(text ?? '')
				.split(/[\s,;]+/)
				.map((entry) => entry.trim().toLowerCase())
				.filter(Boolean)
		)
	];
}

/** Whether an allowlist entry is an address or an `@domain`. */
export function isAllowlistEntry(entry: string): boolean {
	return entry.startsWith('@') ? DOMAIN.test(entry.slice(1)) : ADDRESS.test(entry);
}

function allowlistError(text: string): IMailboxFormError | null {
	const entries = parseAllowlist(text);
	if (entries.length > MAILBOX_ALLOWLIST_MAX) {
		return { key: MAILBOX_ERROR_KEYS.ALLOWLIST_MAX, params: { max: MAILBOX_ALLOWLIST_MAX } };
	}
	const wrong = entries.find((entry) => !isAllowlistEntry(entry));
	return wrong ? { key: MAILBOX_ERROR_KEYS.ALLOWLIST, params: { entry: wrong.slice(0, 80) } } : null;
}

/** Whether a domain is the platform domain or under it (the API refuses those for a custom-domain mailbox). */
export function isPlatformDomain(domain: string, platformDomain: string | null | undefined): boolean {
	if (!platformDomain) return false;
	const root = platformDomain.toLowerCase();
	return domain === root || domain.endsWith(`.${root}`);
}

/** The problems of the "Add mailbox" form, by field (empty: it can be sent). */
export function mailboxCreateErrors(
	state: IMailboxCreateFormState,
	platformDomain: string | null | undefined
): Record<string, IMailboxFormError> {
	const errors: Record<string, IMailboxFormError> = {};
	if (state.ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE && !state.ownerEmployeeId) {
		errors['owner'] = { key: MAILBOX_ERROR_KEYS.REQUIRED };
	}
	if (state.ownerType === InboxMailboxOwnerTypeEnum.TEAM && !state.ownerTeamId) {
		errors['owner'] = { key: MAILBOX_ERROR_KEYS.REQUIRED };
	}
	const localPart = state.localPart.trim().toLowerCase();
	if (state.kind === InboxMailboxKindEnum.CUSTOM_DOMAIN) {
		if (!localPart) errors['localPart'] = { key: MAILBOX_ERROR_KEYS.REQUIRED };
		const domain = state.domain.trim().toLowerCase().replace(/\.$/, '');
		if (!domain) errors['domain'] = { key: MAILBOX_ERROR_KEYS.REQUIRED };
		else if (domain.length > 253 || !DOMAIN.test(domain)) errors['domain'] = { key: MAILBOX_ERROR_KEYS.DOMAIN };
		else if (isPlatformDomain(domain, platformDomain))
			errors['domain'] = { key: MAILBOX_ERROR_KEYS.RESERVED_DOMAIN };
		if (!state.providerAccountId) errors['providerAccountId'] = { key: MAILBOX_ERROR_KEYS.REQUIRED };
	} else if (!platformDomain) {
		errors['kind'] = { key: MAILBOX_ERROR_KEYS.NO_PLATFORM_DOMAIN };
	}
	if (localPart && (localPart.length > MAILBOX_LOCAL_PART_MAX || !LOCAL_PART.test(localPart))) {
		errors['localPart'] = { key: MAILBOX_ERROR_KEYS.LOCAL_PART };
	}
	const forwardFrom = state.forwardFrom.trim();
	if (state.kind === InboxMailboxKindEnum.FORWARDING && forwardFrom && !ADDRESS.test(forwardFrom)) {
		errors['forwardFrom'] = { key: MAILBOX_ERROR_KEYS.ADDRESS };
	}
	if (state.displayName.trim().length > MAILBOX_DISPLAY_NAME_MAX) {
		errors['displayName'] = { key: MAILBOX_ERROR_KEYS.MAX_LENGTH, params: { max: MAILBOX_DISPLAY_NAME_MAX } };
	}
	const allowlist = allowlistError(state.allowlist);
	if (allowlist) errors['allowlist'] = allowlist;
	return errors;
}

/** The `POST /api/inbox/mailboxes` body of the form (only what applies to the chosen owner and kind). */
export function mailboxCreateInput(
	state: IMailboxCreateFormState,
	organizationId?: ID | null
): IInboxMailboxCreateInput {
	const localPart = state.localPart.trim().toLowerCase();
	const displayName = state.displayName.trim();
	const allowlist = parseAllowlist(state.allowlist);
	const forwardFrom = state.forwardFrom.trim();
	return {
		ownerType: state.ownerType,
		...(state.ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE && state.ownerEmployeeId
			? { ownerEmployeeId: state.ownerEmployeeId }
			: {}),
		...(state.ownerType === InboxMailboxOwnerTypeEnum.TEAM && state.ownerTeamId
			? { ownerTeamId: state.ownerTeamId }
			: {}),
		kind: state.kind,
		...(localPart ? { localPart } : {}),
		...(state.kind === InboxMailboxKindEnum.CUSTOM_DOMAIN
			? {
					domain: state.domain.trim().toLowerCase().replace(/\.$/, ''),
					providerAccountId: state.providerAccountId
				}
			: {}),
		...(state.kind === InboxMailboxKindEnum.FORWARDING && forwardFrom ? { forwardFrom } : {}),
		...(displayName ? { displayName } : {}),
		...(allowlist.length ? { senderAllowlist: allowlist } : {}),
		...(state.isDefault ? { isDefault: true } : {}),
		...(organizationId ? { organizationId } : {})
	};
}

/** The fields of the "Edit mailbox" form. */
export interface IMailboxEditFormState {
	displayName: string;
	allowlist: string;
	providerAccountId: ID | null;
	isDefault: boolean;
	/** The Ever Works agent (its agent employee's Gauzy id, or an Ever Works id already stored); `null`: none. */
	everWorksAgentId: string | null;
}

export function mailboxEditForm(mailbox: IInboxMailbox): IMailboxEditFormState {
	return {
		displayName: mailbox.displayName ?? '',
		allowlist: (mailbox.senderAllowlist ?? []).join('\n'),
		providerAccountId: mailbox.providerAccountId ?? null,
		isDefault: !!mailbox.isDefault,
		everWorksAgentId: agentOfMailbox(mailbox)
	};
}

export function mailboxEditErrors(
	state: IMailboxEditFormState,
	mailbox: IInboxMailbox
): Record<string, IMailboxFormError> {
	const errors: Record<string, IMailboxFormError> = {};
	if (state.displayName.trim().length > MAILBOX_DISPLAY_NAME_MAX) {
		errors['displayName'] = { key: MAILBOX_ERROR_KEYS.MAX_LENGTH, params: { max: MAILBOX_DISPLAY_NAME_MAX } };
	}
	if (mailbox.kind === InboxMailboxKindEnum.CUSTOM_DOMAIN && !state.providerAccountId) {
		errors['providerAccountId'] = { key: MAILBOX_ERROR_KEYS.REQUIRED };
	}
	const allowlist = allowlistError(state.allowlist);
	if (allowlist) errors['allowlist'] = allowlist;
	return errors;
}

/**
 * The `PATCH /api/inbox/mailboxes/:id` body of an edit: only what changed. The free `settings` are replaced as a
 * whole by the API, so the agent is merged into the mailbox's other settings (a forwarding mailbox's `forwardFrom`).
 */
export function mailboxUpdateInput(state: IMailboxEditFormState, mailbox: IInboxMailbox): IInboxMailboxUpdateInput {
	const input: IInboxMailboxUpdateInput = {};
	const displayName = state.displayName.trim();
	if (displayName !== (mailbox.displayName ?? '')) input.displayName = displayName || null;
	const allowlist = parseAllowlist(state.allowlist);
	const before = mailbox.senderAllowlist ?? [];
	if (allowlist.length !== before.length || allowlist.some((entry, index) => entry !== before[index])) {
		input.senderAllowlist = allowlist;
	}
	if (
		mailbox.kind === InboxMailboxKindEnum.CUSTOM_DOMAIN &&
		state.providerAccountId !== (mailbox.providerAccountId ?? null)
	) {
		input.providerAccountId = state.providerAccountId;
	}
	if (state.isDefault !== !!mailbox.isDefault) input.isDefault = state.isDefault;
	const agent = state.everWorksAgentId?.trim() || null;
	if (agent !== agentOfMailbox(mailbox)) input.settings = settingsWithAgent(mailbox.settings, agent);
	return input;
}

/** The Ever Works agent a mailbox's mail is handed to, or `null`. */
export function agentOfMailbox(mailbox: Pick<IInboxMailbox, 'settings'> | null | undefined): string | null {
	const value = mailbox?.settings?.[EVER_WORKS_AGENT_SETTING];
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** A mailbox's settings with the agent set (or removed), every other setting kept; `null` when nothing is left. */
export function settingsWithAgent(
	settings: Record<string, unknown> | null | undefined,
	agentId: string | null
): Record<string, unknown> | null {
	const next: Record<string, unknown> = { ...(settings ?? {}) };
	if (agentId) next[EVER_WORKS_AGENT_SETTING] = agentId;
	else delete next[EVER_WORKS_AGENT_SETTING];
	return Object.keys(next).length > 0 ? next : null;
}

/** The address a forwarding mailbox is forwarded from, when the form stated one. */
export function forwardFromOf(mailbox: Pick<IInboxMailbox, 'settings'>): string | null {
	const value = mailbox.settings?.['forwardFrom'];
	return typeof value === 'string' && value ? value : null;
}

/** Whether a mailbox is shared (an organization's or a team's) rather than an employee's own. */
export function isSharedMailbox(mailbox: Pick<IInboxMailbox, 'ownerType'>): boolean {
	return mailbox.ownerType !== InboxMailboxOwnerTypeEnum.EMPLOYEE;
}

/** The accounts a custom-domain mailbox can receive through: not disabled, of a provider that receives mail. */
export function receivingAccounts(accounts: IInboxProviderAccount[]): IInboxProviderAccount[] {
	return accounts.filter(
		(account) =>
			account.status !== InboxProviderAccountStatusEnum.DISABLED && account.capabilities?.inbound !== false
	);
}

/** The badge status of a domain verification. */
export function domainStatusTone(
	status: InboxMailboxDomainStatusEnum | null | undefined
): 'success' | 'warning' | 'danger' {
	if (status === InboxMailboxDomainStatusEnum.VERIFIED) return 'success';
	if (status === InboxMailboxDomainStatusEnum.FAILED) return 'danger';
	return 'warning';
}
