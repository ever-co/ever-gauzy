import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
	ID,
	IEmailProviderDescriptor,
	IInboxMailbox,
	IInboxMailboxCreateInput,
	IInboxMailboxDomainVerification,
	IInboxMailboxMember,
	IInboxMailboxMemberInput,
	IInboxMailboxProvisionInput,
	IInboxMailboxProvisionResult,
	IInboxMailboxSecret,
	IInboxMailboxUpdateInput,
	IInboxOrganizationEmailSettings,
	IInboxProviderAccount,
	IInboxProviderAccountCheck,
	IInboxProviderAccountCreated,
	IInboxProviderAccountCreateInput,
	IInboxProviderAccountRemoved,
	IInboxProviderAccountUpdateInput
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

const INBOX = `${API_PREFIX}/inbox`;
const ACCOUNTS = `${INBOX}/provider-accounts`;
const MAILBOXES = `${INBOX}/mailboxes`;

/** A mailbox as `GET /mailboxes/mine` answers it: with the forwarding instructions of a platform address. */
export type IInboxMyMailbox = IInboxMailbox & { forwardingInstructions?: string };

/** A mailbox as `POST /mailboxes` answers it: a custom-domain one with the DNS record to create. */
export type IInboxCreatedMailbox = IInboxMailbox & { verification?: IInboxMailboxDomainVerification };

/** `?organizationId=` of the management routes. */
function organization(organizationId?: ID | null): { params?: HttpParams } {
	return organizationId ? { params: new HttpParams().set('organizationId', organizationId) } : {};
}

function id(value: ID): string {
	return encodeURIComponent(value);
}

/**
 * The Inbox email management routes of the API (`@gauzy/plugin-inbox`, plan 04 §3, §5): the email provider plugins
 * and their accounts (`/api/inbox/providers`, `/api/inbox/provider-accounts*`, `INBOX_MAILBOX_MANAGE`) and the
 * mailboxes (`/api/inbox/mailboxes*`; `/mine` needs `INBOX_VIEW` only). They exist only where the API loads the Inbox
 * email features (`GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true`): elsewhere every call answers 404.
 *
 * Secrets are write-only: the API never answers a stored one (only which are set, `secretsSet`), and a secret it
 * generates is answered once, by the call that created it. This service passes them through and keeps none.
 */
@Injectable({ providedIn: 'root' })
export class InboxEmailSettingsService {
	private readonly http = inject(HttpClient);

	// ---------------------------------------------------------------- providers and accounts

	/** The provider plugins of this server, with their capabilities and their account forms (`configSchema`). */
	providers(): Observable<IEmailProviderDescriptor[]> {
		return this.http.get<IEmailProviderDescriptor[]>(`${INBOX}/providers`);
	}

	/** The organization's accounts and the tenant's (no secrets). */
	accounts(organizationId?: ID | null): Observable<IInboxProviderAccount[]> {
		return this.http.get<IInboxProviderAccount[]>(ACCOUNTS, organization(organizationId));
	}

	/** Adds an account; the secrets the server generated are in the answer, this once. */
	createAccount(input: IInboxProviderAccountCreateInput): Observable<IInboxProviderAccountCreated> {
		return this.http.post<IInboxProviderAccountCreated>(ACCOUNTS, input);
	}

	/** Changes an account; a rotated generated secret is in the answer, this once. */
	updateAccount(
		accountId: ID,
		input: IInboxProviderAccountUpdateInput,
		organizationId?: ID | null
	): Observable<IInboxProviderAccountCreated> {
		return this.http.patch<IInboxProviderAccountCreated>(
			`${ACCOUNTS}/${id(accountId)}`,
			input,
			organization(organizationId)
		);
	}

	/** "Test connection". */
	verifyAccount(accountId: ID, organizationId?: ID | null): Observable<IInboxProviderAccountCheck> {
		return this.http.post<IInboxProviderAccountCheck>(
			`${ACCOUNTS}/${id(accountId)}/verify`,
			{},
			organization(organizationId)
		);
	}

	/** Removes an account (409 while a mailbox receives through it). */
	removeAccount(accountId: ID, organizationId?: ID | null): Observable<IInboxProviderAccountRemoved> {
		return this.http.delete<IInboxProviderAccountRemoved>(
			`${ACCOUNTS}/${id(accountId)}`,
			organization(organizationId)
		);
	}

	// ---------------------------------------------------------------- mailboxes

	/** The signed-in user's mailboxes (personal and shared), with forwarding instructions. */
	myMailboxes(): Observable<IInboxMyMailbox[]> {
		return this.http.get<IInboxMyMailbox[]>(`${MAILBOXES}/mine`);
	}

	/** The organization's mailboxes. */
	mailboxes(organizationId?: ID | null): Observable<IInboxMailbox[]> {
		return this.http.get<IInboxMailbox[]>(MAILBOXES, organization(organizationId));
	}

	createMailbox(input: IInboxMailboxCreateInput): Observable<IInboxCreatedMailbox> {
		return this.http.post<IInboxCreatedMailbox>(MAILBOXES, input);
	}

	updateMailbox(
		mailboxId: ID,
		input: IInboxMailboxUpdateInput,
		organizationId?: ID | null
	): Observable<IInboxMailbox> {
		return this.http.patch<IInboxMailbox>(`${MAILBOXES}/${id(mailboxId)}`, input, organization(organizationId));
	}

	/** The DNS record of a custom-domain mailbox and its last status (no DNS lookup). */
	mailboxVerification(mailboxId: ID, organizationId?: ID | null): Observable<IInboxMailboxDomainVerification> {
		return this.http.get<IInboxMailboxDomainVerification>(
			`${MAILBOXES}/${id(mailboxId)}/verification`,
			organization(organizationId)
		);
	}

	/** Checks the DNS record of a custom-domain mailbox now. */
	verifyMailbox(mailboxId: ID, organizationId?: ID | null): Observable<IInboxMailboxDomainVerification> {
		return this.http.post<IInboxMailboxDomainVerification>(
			`${MAILBOXES}/${id(mailboxId)}/verify`,
			{},
			organization(organizationId)
		);
	}

	/** A new relay secret for a mailbox, answered this once. */
	rotateMailboxSecret(mailboxId: ID, organizationId?: ID | null): Observable<IInboxMailboxSecret> {
		return this.http.post<IInboxMailboxSecret>(
			`${MAILBOXES}/${id(mailboxId)}/rotate-secret`,
			{},
			organization(organizationId)
		);
	}

	members(mailboxId: ID, organizationId?: ID | null): Observable<IInboxMailboxMember[]> {
		return this.http.get<IInboxMailboxMember[]>(
			`${MAILBOXES}/${id(mailboxId)}/members`,
			organization(organizationId)
		);
	}

	/** Replaces the members of a shared mailbox. */
	setMembers(
		mailboxId: ID,
		members: IInboxMailboxMemberInput[],
		organizationId?: ID | null
	): Observable<IInboxMailboxMember[]> {
		return this.http.put<IInboxMailboxMember[]>(
			`${MAILBOXES}/${id(mailboxId)}/members`,
			{ members },
			organization(organizationId)
		);
	}

	/** Creates the missing employee mailboxes and the default organization mailbox now. */
	provision(input: IInboxMailboxProvisionInput): Observable<IInboxMailboxProvisionResult> {
		return this.http.post<IInboxMailboxProvisionResult>(`${MAILBOXES}/provision`, input);
	}

	/** The organization's email settings and the server's platform mailbox domain. */
	emailSettings(organizationId?: ID | null): Observable<IInboxOrganizationEmailSettings> {
		return this.http.get<IInboxOrganizationEmailSettings>(`${MAILBOXES}/settings`, organization(organizationId));
	}

	updateEmailSettings(
		autoProvisionEmployees: boolean,
		organizationId?: ID | null
	): Observable<IInboxOrganizationEmailSettings> {
		return this.http.put<IInboxOrganizationEmailSettings>(
			`${MAILBOXES}/settings`,
			{ autoProvisionEmployees },
			organization(organizationId)
		);
	}
}
