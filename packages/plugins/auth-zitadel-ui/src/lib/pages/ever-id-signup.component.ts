import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCheckboxModule, NbInputModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ITermsAcceptanceDocument, IWorkspaceResponse } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';
import { EverIdWorkspacesComponent } from '../components/ever-id-workspaces.component';
import { AuthZitadelUiService, EverIdSignupDetails, EverIdWorkspaceResponse } from '../services/auth-zitadel-ui.service';
import { EverIdSignInService } from '../services/ever-id-sign-in.service';

/** How often the details are asked for again while another attempt uses the key. */
const MAX_DETAILS_RETRIES = 3;

/** The wait the API asked for (`retryAfter`, seconds), as milliseconds; two seconds by default. */
function retryDelayMs(failure: { error?: { retryAfter?: unknown } } | null | undefined): number {
	const seconds = Number(failure?.error?.retryAfter);
	return Number.isFinite(seconds) && seconds > 0 && seconds <= 30 ? seconds * 1000 : 2000;
}

/**
 * `#/auth/ever-id/signup?handoff=…` (Ever Cloud only): "Create a Gauzy workspace with this Ever ID".
 *
 * Shows the verified name and e-mail (fetched with the one-time key; nothing personal is in the URL)
 * and creates the account only when the person ticks the confirmation and presses the button. Gauzy's
 * own register path runs on the server, behind Gauzy's own subscription gate: without a subscription
 * the page links to checkout, and the sign-up finishes the next time the person signs in with Ever ID.
 */
@Component({
	selector: 'ngx-ever-id-signup',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCheckboxModule,
		NbInputModule,
		RouterLink,
		TranslateModule,
		EverIdWorkspacesComponent
	],
	template: `
		<section class="ever-id-page">
			<h2 class="title">{{ 'AUTH_ZITADEL.SIGNUP.TITLE' | translate }}</h2>
			@if (expired) {
				<nb-alert status="danger" role="alert">{{ 'AUTH_ZITADEL.ERRORS.expired' | translate }}</nb-alert>
				<a nbButton status="primary" routerLink="/auth/login">{{ 'AUTH_ZITADEL.BACK_TO_LOGIN' | translate }}</a>
			} @else if (response) {
				<ngx-ever-id-workspaces [response]="response" [busy]="busy" (selected)="signIn($event)"></ngx-ever-id-workspaces>
			} @else if (details) {
				@if (checkoutUrl) {
					<nb-alert status="info" role="status">
						{{ 'AUTH_ZITADEL.SIGNUP.SUBSCRIPTION_REQUIRED' | translate }}
					</nb-alert>
					<a nbButton status="primary" fullWidth class="checkout" [attr.href]="checkoutUrl">
						{{ 'AUTH_ZITADEL.SIGNUP.CONTINUE_TO_CHECKOUT' | translate }}
					</a>
					<p class="hint">{{ 'AUTH_ZITADEL.SIGNUP.AFTER_CHECKOUT' | translate: { email: details.email } }}</p>
				} @else {
					<p>{{ 'AUTH_ZITADEL.SIGNUP.DESCRIPTION' | translate }}</p>
					<form (ngSubmit)="submit()" class="signup-form">
						<label class="label" for="ever-id-email">{{ 'AUTH_ZITADEL.SIGNUP.EMAIL' | translate }}</label>
						<input nbInput fullWidth id="ever-id-email" name="email" [value]="details.email" readonly />
						<label class="label" for="ever-id-first-name">{{ 'AUTH_ZITADEL.SIGNUP.FIRST_NAME' | translate }}</label>
						<input nbInput fullWidth id="ever-id-first-name" name="firstName" [(ngModel)]="firstName" maxlength="100" />
						<label class="label" for="ever-id-last-name">{{ 'AUTH_ZITADEL.SIGNUP.LAST_NAME' | translate }}</label>
						<input nbInput fullWidth id="ever-id-last-name" name="lastName" [(ngModel)]="lastName" maxlength="100" />
						@if (termsDocuments.length) {
							<nb-checkbox name="terms" [(ngModel)]="termsAccepted" class="terms">
								{{ 'AUTH_ZITADEL.SIGNUP.ACCEPT_TERMS' | translate }}
								@for (document of termsDocuments; track document.documentId) {
									<a [attr.href]="document.url" target="_blank" rel="noopener noreferrer">{{ document.title || document.documentId }}</a>
								}
							</nb-checkbox>
						}
						<nb-checkbox name="confirm" [(ngModel)]="confirmed" class="confirm">
							{{ 'AUTH_ZITADEL.SIGNUP.CONFIRM' | translate }}
						</nb-checkbox>
						@if (termsUnavailable) {
							<nb-alert status="danger" role="alert">{{ 'AUTH_ZITADEL.ERRORS.try_again' | translate }}</nb-alert>
							<button nbButton ghost fullWidth type="button" (click)="loadTerms()">
								{{ 'AUTH_ZITADEL.SIGNUP.RETRY' | translate }}
							</button>
						}
						@if (failed) {
							<nb-alert status="danger" role="alert">{{ 'AUTH_ZITADEL.ERRORS.sign_in_failed' | translate }}</nb-alert>
						}
						@if (retryLater) {
							<nb-alert status="warning" role="alert">{{ 'AUTH_ZITADEL.ERRORS.busy' | translate }}</nb-alert>
						}
						<button nbButton status="primary" fullWidth type="submit" class="create" [disabled]="!canSubmit()">
							{{ 'AUTH_ZITADEL.SIGNUP.CREATE' | translate }}
						</button>
						<a nbButton ghost fullWidth routerLink="/auth/login">{{ 'AUTH_ZITADEL.SIGNUP.CANCEL' | translate }}</a>
					</form>
				}
			} @else if (detailsBusy) {
				<nb-alert status="warning" role="alert">{{ 'AUTH_ZITADEL.ERRORS.busy' | translate }}</nb-alert>
				<button nbButton status="primary" fullWidth type="button" (click)="retryDetails()">
					{{ 'AUTH_ZITADEL.SIGNUP.RETRY' | translate }}
				</button>
			} @else {
				<p>{{ 'AUTH_ZITADEL.HANDOFF.SIGNING_IN' | translate }}</p>
			}
		</section>
	`,
	styles: [
		`
			.signup-form {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}
			.terms a {
				margin-left: 4px;
			}
		`
	]
})
export class EverIdSignupComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly api = inject(AuthZitadelUiService);
	private readonly authService = inject(AuthService);
	private readonly translate = inject(TranslateService);
	private readonly signInService = inject(EverIdSignInService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	details: EverIdSignupDetails | null = null;
	response: EverIdWorkspaceResponse | null = null;
	termsDocuments: ITermsAcceptanceDocument[] = [];
	firstName = '';
	lastName = '';
	termsAccepted = false;
	/** The required documents arrived (possibly none); until then nothing can be submitted. */
	termsLoaded = false;
	termsUnavailable = false;
	confirmed = false;
	checkoutUrl: string | null = null;
	expired = false;
	failed = false;
	/** Another attempt was using the key: the person may simply submit again. */
	retryLater = false;
	/** The details could not be read yet because another attempt kept the key busy. */
	detailsBusy = false;
	busy = false;
	private handoff = '';
	private detailsRetries = 0;

	ngOnInit(): void {
		this.handoff = this.route.snapshot.queryParams['handoff'] ?? '';
		if (!this.handoff) {
			this.expired = true;
			return;
		}
		this.loadDetails();
	}

	/** Reads the verified details and the documents to accept with the one-time key (it stays valid). */
	private loadDetails(): void {
		this.api
			.signupDetails(this.handoff)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (details) => {
					this.details = details;
					this.firstName = details.firstName ?? '';
					this.lastName = details.lastName ?? '';
					this.checkoutUrl = details.status === 'subscription_required' ? details.checkoutUrl || null : null;
					if (Array.isArray(details.terms)) {
						// The API lists the documents itself, with links that open the web app's own pages.
						this.termsDocuments = details.terms;
						this.termsLoaded = true;
						this.termsUnavailable = false;
					} else {
						this.loadTerms();
					}
					this.cdr.markForCheck();
				},
				error: (failure) => {
					// 409: another attempt (another tab) is using the key right now; ask again shortly, and
					// after a few tries let the person ask again: the key is still valid.
					if (failure?.status === 409) {
						if (this.detailsRetries < MAX_DETAILS_RETRIES) {
							this.detailsRetries++;
							const timer = setTimeout(() => this.loadDetails(), retryDelayMs(failure));
							this.destroyRef.onDestroy(() => clearTimeout(timer));
							return;
						}
						this.detailsBusy = true;
					} else {
						this.expired = true;
					}
					this.cdr.markForCheck();
				}
			});
	}

	/** Reads the details again after the automatic tries met a busy key. */
	retryDetails(): void {
		this.detailsBusy = false;
		this.detailsRetries = 0;
		this.loadDetails();
	}

	/** Loads the documents Gauzy currently requires (again, after a failure). */
	loadTerms(): void {
		this.termsUnavailable = false;
		this.authService
			.getRequiredTermsDocuments(this.translate.currentLang)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (documents) => {
					this.termsDocuments = documents ?? [];
					this.termsLoaded = true;
					this.cdr.markForCheck();
				},
				error: () => {
					// Without the list the page cannot show what must be accepted: no account is created.
					this.termsUnavailable = true;
					this.cdr.markForCheck();
				}
			});
	}

	/**
	 * The button stays disabled until the required documents are known and the person confirms (and
	 * accepts the documents, when there are any).
	 */
	canSubmit(): boolean {
		return this.termsLoaded && this.confirmed && (!this.termsDocuments.length || this.termsAccepted) && !this.busy;
	}

	submit(): void {
		if (!this.canSubmit()) {
			return;
		}
		this.busy = true;
		this.failed = false;
		this.retryLater = false;
		this.api
			.signup({
				handoff: this.handoff,
				confirm: true,
				firstName: this.firstName.trim() || undefined,
				lastName: this.lastName.trim() || undefined,
				terms: this.termsAccepted
					? this.termsDocuments.map(({ documentId, version, sha256, locale }) => ({ documentId, version, sha256, locale }))
					: undefined
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (response) => {
					this.busy = false;
					this.response = response;
					this.cdr.markForCheck();
					if (response.total_workspaces === 1) {
						this.signIn(response.workspaces[0]);
					}
				},
				error: (failure) => {
					this.busy = false;
					if (failure?.status === 403 && failure?.error?.checkoutUrl) {
						this.checkoutUrl = failure.error.checkoutUrl;
					} else if (failure?.status === 410) {
						this.expired = true;
					} else if (failure?.status === 409 || failure?.status === 429) {
						// The key is still valid: another attempt was using it, or it was tried too often just now.
						this.retryLater = true;
					} else {
						this.failed = true;
					}
					this.cdr.markForCheck();
				}
			});
	}

	signIn(workspace: IWorkspaceResponse): void {
		// Also reached automatically for a single workspace: never send a second sign-in.
		if (!this.response || this.busy) {
			return;
		}
		this.busy = true;
		this.signInService
			.signIn(this.response.confirmed_email, workspace, this.response.redirect)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				error: () => {
					this.busy = false;
					this.failed = true;
					this.cdr.markForCheck();
				}
			});
	}
}
