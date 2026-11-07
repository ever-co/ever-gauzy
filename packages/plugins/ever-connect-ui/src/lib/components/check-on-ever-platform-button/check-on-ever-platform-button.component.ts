import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	DestroyRef,
	inject,
	Input,
	OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NbButtonModule, NbDialogService } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, EMPTY, from, Observable, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { OrganizationContactService, Store } from '@gauzy/ui-core/core';
import { EverConnectIntegration, EverConnectUiService } from '../../services/ever-connect.service';
import { CheckOnEverPlatformDialogComponent, everPlatformProfileUrl } from './check-on-ever-platform-dialog.component';

/** The integration this button belongs to. */
export const COUNTERPARTY_LOOKUP = 'counterparty_lookup';

/** What the check of a contact starts from: its e-mail, its country and its fiscal information. */
export interface ContactToCheck {
	id?: string | null;
	organizationId?: string | null;
	primaryEmail?: string | null;
	contact?: { country?: string | null; fiscalInformation?: string | null } | null;
}

/**
 * Whether the button is shown for this row of `GET /api/ever-connect/integrations`: only when the
 * counterparty check is enabled for the organization's link and its entitlement grants the feature.
 */
export function lookupShown(row: EverConnectIntegration | null | undefined): boolean {
	return (
		!!row &&
		row.key === COUNTERPARTY_LOOKUP &&
		row.state === 'enabled' &&
		row.enabled === true &&
		row.feature_on === true
	);
}

/**
 * A suggestion for the VAT field, from the contact's free-text fiscal information: something that
 * reads like a VAT number (a two-letter prefix and digits), else the text when it is short. Only a
 * suggestion: it is shown in the field, to edit, and never written back.
 */
export function vatSuggestion(fiscalInformation: string | null | undefined): string {
	const text = (fiscalInformation ?? '').trim();
	if (!text) return '';
	const match = /\b([A-Za-z]{2}[\s.-]?[0-9][0-9A-Za-z\s./-]{3,18}[0-9A-Za-z])\b/.exec(text);
	if (match) return match[1].trim();
	return text.length <= 20 ? text : '';
}

/**
 * "Check on Ever Platform" on a contact: shown only while the counterparty check is enabled for the
 * organization (consented in app.ever.co) and its entitlement grants the feature; otherwise nothing
 * is rendered (and where the Ever Platform module is not loaded, its 404 hides it). It asks this
 * installation's API only: the API hashes the values and sends Ever Platform the hashes.
 *
 * With "check a contact when it is opened" on (off by default), the contact's e-mail is checked once
 * when the page opens (the API keeps the answer); otherwise nothing is checked until the button is
 * clicked.
 */
@Component({
	selector: 'ngx-ever-connect-check-on-ever-platform',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, TranslatePipe],
	template: `
		@if (visible) {
			<span class="check-on-ever-platform">
				<button
					nbButton
					size="small"
					status="basic"
					type="button"
					data-test="check-on-ever-platform"
					[disabled]="opening"
					(click)="open()"
				>
					{{ 'EVER_CONNECT.LOOKUP.BUTTON' | translate }}
				</button>
				@if (autoMatch) {
					<a
						class="auto-match"
						data-test="auto-match"
						[href]="profileUrl(autoMatch)"
						target="_blank"
						rel="noopener noreferrer"
						>ever.co/{{ autoMatch }}</a
					>
				}
			</span>
		}
	`,
	styles: [
		`
			.check-on-ever-platform {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
			}
			.auto-match {
				font-size: 0.8125rem;
			}
		`
	]
})
export class CheckOnEverPlatformButtonComponent implements OnInit {
	private readonly api = inject(EverConnectUiService);
	private readonly store = inject(Store);
	private readonly contacts = inject(OrganizationContactService);
	private readonly route = inject(ActivatedRoute, { optional: true });
	private readonly dialogs = inject(NbDialogService, { optional: true });
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	/** The contact, when the host page passes it; otherwise the contact of the page's `:id` is read when needed. */
	@Input() contact: ContactToCheck | null = null;

	visible = false;
	opening = false;
	/** The handle the automatic check found, if any. */
	autoMatch: string | null = null;
	private organizationId: string | null = null;
	private contactId: string | null = null;

	readonly profileUrl = everPlatformProfileUrl;

	ngOnInit(): void {
		const contactId$ = this.route?.paramMap?.pipe(map((params) => params.get('id'))) ?? of(null);
		const organizationId$ = (this.store.selectedOrganization$ ?? of(null)).pipe(
			map((organization) => organization?.id ?? null)
		);
		combineLatest([contactId$, organizationId$])
			.pipe(
				distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1]),
				tap(([contactId, organizationId]) => {
					this.visible = false;
					this.autoMatch = null;
					this.contactId = contactId ?? this.contact?.id ?? null;
					this.organizationId = organizationId;
					this.cdr.markForCheck();
				}),
				switchMap(([, organizationId]) => (organizationId ? this.show(organizationId) : EMPTY)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}

	/** Shows the button when the check is enabled; with the automatic check on, checks the e-mail once. */
	private show(organizationId: string): Observable<unknown> {
		return this.api.integrations(organizationId).pipe(
			map((rows) => rows.find((row) => row.key === COUNTERPARTY_LOOKUP) ?? null),
			// The module is not loaded (404), the person may not see integrations (403), or it failed: no button.
			catchError(() => of(null)),
			switchMap((row) => {
				if (!lookupShown(row) || (!this.contactId && !this.contact)) return EMPTY;
				this.visible = true;
				this.cdr.markForCheck();
				return row?.options?.auto_check === true ? this.autoCheck(organizationId) : EMPTY;
			})
		);
	}

	private autoCheck(organizationId: string): Observable<unknown> {
		return from(this.readContact()).pipe(
			switchMap((contact) => {
				const email = (contact?.primaryEmail ?? '').trim();
				if (!email || (contact?.organizationId && contact.organizationId !== organizationId)) return EMPTY;
				return this.api.lookup(organizationId, [{ kind: 'email', value: email }]);
			}),
			tap((answer) => {
				const found = answer.items.find((item) => item.status === 'match' && item.handle);
				this.autoMatch = found?.handle ?? null;
				this.cdr.markForCheck();
			}),
			catchError(() => EMPTY)
		);
	}

	/** The contact: as passed, else read (with its address) from this installation's API. */
	private async readContact(): Promise<ContactToCheck | null> {
		if (this.contact) return this.contact;
		if (!this.contactId) return null;
		try {
			const tenantId = this.store.user?.tenantId;
			return (await this.contacts.getById(this.contactId, tenantId, ['contact'])) as ContactToCheck;
		} catch {
			return null;
		}
	}

	/** Opens the check, prefilled from the contact (nothing is written back to it). */
	async open(): Promise<void> {
		const organizationId = this.organizationId;
		if (!organizationId || this.opening) return;
		this.opening = true;
		this.cdr.markForCheck();
		const contact = await this.readContact();
		this.opening = false;
		this.cdr.markForCheck();
		// A contact of another organization (the organization selector changed on this page) is never
		// checked under this organization's link.
		if (contact?.organizationId && contact.organizationId !== organizationId) return;
		const vat = vatSuggestion(contact?.contact?.fiscalInformation);
		this.dialogs?.open(CheckOnEverPlatformDialogComponent, {
			context: {
				organizationId,
				email: (contact?.primaryEmail ?? '').trim(),
				vat,
				vatSuggested: vat.length > 0,
				country: (contact?.contact?.country ?? '').trim().toUpperCase()
			}
		});
	}
}
