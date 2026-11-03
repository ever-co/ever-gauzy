import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCheckboxModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IAuthResponse, ITermsAcceptanceClaim, IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { AuthService, Store } from '@gauzy/ui-core/core';
import {
	EVER_RETURN_ORIGINS,
	EverConnectProvisionService,
	handoffKeyOf,
	isEverReturnUrl,
	ProvisionResult,
	ProvisionSummary
} from './provision.service';

/** The error codes the page explains; anything else is the generic message. */
const KNOWN_ERRORS = new Set([
	'identity_mismatch',
	'intent_expired',
	'intent_invalid',
	'sign_in_required',
	'intent_replayed',
	'organization_already_linked',
	'validation_failed',
	'terms_required',
	'provisioning_in_progress',
	'rate_limited',
	'not_found'
]);

/** Errors after which trying again on this page can help. */
const RETRYABLE = new Set(['provisioning_failed', 'provisioning_in_progress', 'rate_limited', 'generic']);

/** The code of a failed request (`application/problem+json` `code`), or `generic`. */
export function errorCodeOf(failure: { status?: number; error?: unknown } | null | undefined): string {
	if (failure?.status === 404) return 'not_found';
	const body = failure?.error;
	const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
	if (typeof code === 'string' && KNOWN_ERRORS.has(code)) return code;
	return code === 'provisioning_failed' ? 'provisioning_failed' : 'generic';
}

/**
 * `#/auth/ever-connect/provision?provision=…&handoff=…`: the one confirmation of creating a workspace
 * the person asked for in Ever. The URL holds two opaque one-time keys only; what the page shows comes
 * from the API (the organization's public names, the e-mail of the person's own Ever ID sign-in, what
 * will be created). **Create** creates it, signs the person in through Gauzy's own workspace sign-in,
 * and sends them back to Ever.
 */
@Component({
	selector: 'ngx-ever-connect-provision-confirm',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbAlertModule, NbButtonModule, NbCheckboxModule, NbInputModule, TranslatePipe],
	template: `
		<section class="ever-connect-provision">
			<h2 class="title">{{ 'EVER_CONNECT.PROVISION.TITLE' | translate }}</h2>
			@if (error && error !== 'terms_required') {
				<nb-alert
					[status]="error === 'provisioning_in_progress' ? 'warning' : 'danger'"
					role="alert"
					class="error"
				>
					{{ 'EVER_CONNECT.PROVISION.ERRORS.' + error | translate }}
				</nb-alert>
				@if (retryable && summary) {
					<button
						nbButton
						status="primary"
						fullWidth
						type="button"
						class="retry"
						(click)="create()"
						[disabled]="busy"
					>
						{{ 'EVER_CONNECT.PROVISION.RETRY' | translate }}
					</button>
				}
				@if (returnTo) {
					<a nbButton ghost fullWidth class="back" [attr.href]="returnTo">{{
						'EVER_CONNECT.PROVISION.BACK_TO_EVER' | translate
					}}</a>
				}
			} @else if (result) {
				<nb-alert status="success" role="status">
					{{
						'EVER_CONNECT.PROVISION.' + (result.status === 'created' ? 'CREATED' : 'EXISTS')
							| translate: { name: summary?.org_display_name }
					}}
				</nb-alert>
				@if (openUrl) {
					<p>{{ 'EVER_CONNECT.PROVISION.SIGN_IN_ELSEWHERE' | translate }}</p>
				} @else {
					<p>{{ 'EVER_CONNECT.PROVISION.SIGNING_IN' | translate }}</p>
				}
				@if (openUrl) {
					<a nbButton status="primary" fullWidth class="open" [attr.href]="openUrl">{{
						'EVER_CONNECT.PROVISION.OPEN' | translate
					}}</a>
				}
				@if (returnTo) {
					<a nbButton ghost fullWidth class="back" [attr.href]="returnTo">{{
						'EVER_CONNECT.PROVISION.BACK_TO_EVER' | translate
					}}</a>
				}
			} @else if (summary) {
				<p class="lead">
					{{
						'EVER_CONNECT.PROVISION.LEAD'
							| translate: { name: summary.org_display_name, handle: summary.handle }
					}}
				</p>
				@if (summary.product_tenant_exists) {
					<nb-alert status="info" role="status">{{
						'EVER_CONNECT.PROVISION.ALREADY_CREATED' | translate
					}}</nb-alert>
				}
				<p>{{ 'EVER_CONNECT.PROVISION.WILL_CREATE' | translate }}</p>
				<ul class="items">
					<li>
						{{ 'EVER_CONNECT.PROVISION.ITEMS.WORKSPACE' | translate: { name: summary.org_display_name } }}
					</li>
					<li>
						{{
							'EVER_CONNECT.PROVISION.ITEMS.ORGANIZATION'
								| translate: { name: summary.legal_name || summary.org_display_name }
						}}
					</li>
					<li>{{ 'EVER_CONNECT.PROVISION.ITEMS.ADMIN_ACCOUNT' | translate }}</li>
					<li>{{ 'EVER_CONNECT.PROVISION.ITEMS.EMPLOYEE' | translate }}</li>
					@if (summary.creates.team) {
						<li>{{ 'EVER_CONNECT.PROVISION.ITEMS.TEAM' | translate }}</li>
					}
				</ul>
				<form class="form" (ngSubmit)="create()">
					<label class="label" for="provision-email">{{ 'EVER_CONNECT.PROVISION.EMAIL' | translate }}</label>
					<input nbInput fullWidth id="provision-email" name="email" [value]="summary.email" readonly />
					<label class="label" for="provision-first-name">{{
						'EVER_CONNECT.PROVISION.FIRST_NAME' | translate
					}}</label>
					<input
						nbInput
						fullWidth
						id="provision-first-name"
						name="firstName"
						[(ngModel)]="firstName"
						maxlength="100"
					/>
					<label class="label" for="provision-last-name">{{
						'EVER_CONNECT.PROVISION.LAST_NAME' | translate
					}}</label>
					<input
						nbInput
						fullWidth
						id="provision-last-name"
						name="lastName"
						[(ngModel)]="lastName"
						maxlength="100"
					/>
					@if (error === 'terms_required') {
						<nb-alert status="danger" role="alert" class="error">
							{{ 'EVER_CONNECT.PROVISION.ERRORS.terms_required' | translate }}
						</nb-alert>
					}
					@if (summary.terms?.length) {
						<nb-checkbox name="terms" [(ngModel)]="termsAccepted" class="terms">
							{{ 'EVER_CONNECT.PROVISION.TERMS' | translate }}
							@for (document of summary.terms; track document.documentId) {
								<a [attr.href]="document.url" target="_blank" rel="noopener noreferrer">{{
									document.title || document.documentId
								}}</a>
							}
						</nb-checkbox>
					}
					<button
						nbButton
						status="primary"
						fullWidth
						type="submit"
						class="create"
						[disabled]="busy || (!!summary.terms?.length && !termsAccepted)"
					>
						{{ 'EVER_CONNECT.PROVISION.CREATE' | translate }}
					</button>
					@if (returnTo) {
						<a nbButton ghost fullWidth class="back" [attr.href]="returnTo">{{
							'EVER_CONNECT.PROVISION.CANCEL' | translate
						}}</a>
					}
				</form>
			} @else {
				<p>{{ 'EVER_CONNECT.PROVISION.LOADING' | translate }}</p>
			}
		</section>
	`,
	styles: [
		`
			.form {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}
			.items {
				margin: 0 0 1rem;
			}
			.terms a {
				margin-left: 4px;
			}
		`
	]
})
export class ProvisionConfirmComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly api = inject(EverConnectProvisionService);
	private readonly authService = inject(AuthService);
	private readonly store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	private provisionKey = '';
	private handoffKey = '';

	summary: ProvisionSummary | null = null;
	result: ProvisionResult | null = null;
	error: string | null = null;
	retryable = false;
	busy = false;
	firstName = '';
	lastName = '';
	termsAccepted = false;
	/** Ever's page to go back to (only a page of Ever's web app). */
	returnTo: string | null = null;
	/** The workspace's one-time sign-in link, when the automatic sign-in did not happen. */
	openUrl: string | null = null;

	ngOnInit(): void {
		const { provision, handoff } = this.route.snapshot.queryParams;
		if (typeof provision !== 'string' || typeof handoff !== 'string' || !provision || !handoff) {
			this.fail('intent_invalid');
			return;
		}
		this.provisionKey = provision;
		this.handoffKey = handoff;
		this.api
			.summary(provision, handoff)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (summary) => {
					this.summary = summary;
					this.firstName = summary.first_name ?? '';
					this.lastName = summary.last_name ?? '';
					this.returnTo = isEverReturnUrl(summary.return_to) ? summary.return_to : null;
					this.cdr.markForCheck();
				},
				error: (failure) => {
					// Without a summary there is no verified return address: Ever's own start page.
					this.returnTo = this.returnTo ?? EVER_RETURN_ORIGINS[0];
					this.fail(errorCodeOf(failure));
				}
			});
	}

	create(): void {
		if (!this.summary || this.busy) {
			return;
		}
		this.busy = true;
		this.error = null;
		this.cdr.markForCheck();
		// The documents as the summary listed them, echoed back: the API and Gauzy's register path check them.
		const terms: ITermsAcceptanceClaim[] = this.termsAccepted
			? (this.summary.terms ?? []).map(({ documentId, version, sha256, locale }) => ({
					documentId,
					version,
					sha256,
					locale
				}))
			: [];
		const request = {
			...(this.firstName.trim() ? { first_name: this.firstName.trim() } : {}),
			...(this.lastName.trim() ? { last_name: this.lastName.trim() } : {}),
			...(terms.length ? { terms } : {})
		};
		this.api
			.create(this.provisionKey, this.handoffKey, request)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.busy = false;
					this.result = result;
					this.returnTo = isEverReturnUrl(result.return_to) ? result.return_to : this.returnTo;
					this.cdr.markForCheck();
					this.signIn(result);
				},
				error: (failure) => {
					this.busy = false;
					this.fail(errorCodeOf(failure));
				}
			});
	}

	/** Signs the owner in to the new workspace (Gauzy's own workspace sign-in), then back to Ever. */
	private signIn(result: ProvisionResult): void {
		const key = handoffKeyOf(result.sign_in_url);
		if (!key) {
			// No sign-in key came back (it expired meanwhile): the person signs in with Ever ID from the login page.
			this.openUrl = '#/auth/login';
			this.cdr.markForCheck();
			return;
		}
		this.api
			.redeemSignIn(key)
			.pipe(
				switchMap((record): Observable<IAuthResponse | null> => {
					const response = (record as { kind: string; response?: IUserSigninWorkspaceResponse }).response;
					const workspace = record.kind === 'workspaces' ? response?.workspaces?.[0] : undefined;
					if (!workspace || !response) return of(null);
					return this.authService.signinWorkspaceByToken({
						email: response.confirmed_email,
						token: workspace.token
					});
				}),
				map((session) => {
					if (!session) return false;
					this.store.userId = session.user.id;
					this.store.user = session.user;
					this.store.token = session.token;
					this.store.refresh_token = session.refresh_token;
					this.store.organizationId = session.user.employee?.organizationId;
					this.store.tenantId = session.user.tenantId;
					return true;
				}),
				catchError(() => of(false)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((signedIn) => {
				if (!signedIn) {
					// The one-time key may be used up already: the person signs in with Ever ID from the login page.
					this.openUrl = '#/auth/login';
					this.cdr.markForCheck();
					return;
				}
				if (this.returnTo) {
					this.goTo(this.returnTo);
				} else {
					this.router.navigateByUrl('/pages/dashboard');
				}
			});
	}

	/** Leaves the web app for Ever's page (checked to be one before). */
	protected goTo(url: string): void {
		window.location.assign(url);
	}

	private fail(code: string): void {
		this.error = code;
		this.retryable = RETRYABLE.has(code);
		this.cdr.markForCheck();
	}
}
