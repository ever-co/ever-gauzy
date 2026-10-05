import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbButtonModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { AuthService, Store } from '@gauzy/ui-core/core';

type ResendState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * "Verify your email" notice with a Resend button, for a signed-in user who has not verified yet.
 *
 * Registering signs people straight in, and until now nothing in the app said a verification email
 * had been sent, or offered another one if it never arrived. On a deployment that sells
 * subscriptions this matters beyond hygiene: a paid Stripe subscription is only connected to a
 * workspace once its owner has verified the address (see `TenantService.linkStripeCustomer`).
 *
 * Shows only when the API confirms the user is unverified (`GET /auth/email/verify/status`). That
 * endpoint answers 404 where email verification is switched off, so self-hosted installs without
 * verification never see the notice, even though none of their users is "verified".
 *
 * Says "we sent you a link" only when the API reports a still-valid verification email really went
 * out (`verificationEmailSent`). Users invited or signed up before verification was switched on, or
 * whose link expired, were never sent a working one; for them the notice offers to send it instead
 * of promising an email that is not coming.
 *
 * - `banner` (default): a dismissible strip for the main layout.
 * - `inline`: no dismiss button, for pages explaining why something is missing (Billing).
 */
@Component({
	selector: 'ngx-email-verification-notice',
	standalone: true,
	imports: [CommonModule, NbButtonModule, TranslateModule],
	templateUrl: './email-verification-notice.component.html',
	styleUrls: ['./email-verification-notice.component.scss']
})
export class EmailVerificationNoticeComponent implements OnInit {
	/** `banner` for the layout, `inline` for a page body. */
	@Input() variant: 'banner' | 'inline' = 'banner';
	/** Translation key of the explanation shown when a verification email has been sent. */
	@Input() messageKey = 'EMAIL_VERIFICATION.NOTICE';
	/** Translation key of the explanation shown when no valid verification email has been sent yet. */
	@Input() notSentMessageKey = 'EMAIL_VERIFICATION.NOTICE_NOT_SENT';

	readonly visible = signal(false);
	readonly state = signal<ResendState>('idle');
	readonly errorMessage = signal<string | null>(null);
	readonly email = signal<string | null>(null);
	/** Whether a still-valid verification email has gone out (per the API, or our own send). */
	readonly linkSent = signal(false);

	private dismissed = false;
	/** The user the notice currently speaks for; a resend answer for anyone else is dropped. */
	private currentUserId: string | null = null;
	/** Their address: a link (sent, or being sent) belongs to one address, not to the account. */
	private currentEmail: string | null = null;
	private resendSubscription: Subscription | null = null;
	/** The status re-read after a failed resend; a newer resend makes its answer stale. */
	private refreshSubscription: Subscription | null = null;

	private readonly store = inject(Store);
	private readonly authService = inject(AuthService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	ngOnInit(): void {
		this.store.user$
			.pipe(
				map((user: IUser) =>
					user ? { id: user.id, email: user.email, unverified: user.isEmailVerified === false } : null
				),
				distinctUntilChanged(
					(a, b) => a?.id === b?.id && a?.email === b?.email && a?.unverified === b?.unverified
				),
				switchMap((user) => {
					// Another user signed in: forget the previous user's dismissal and resend (even one in flight).
					if ((user?.id ?? null) !== this.currentUserId) {
						this.currentUserId = user?.id ?? null;
						this.currentEmail = user?.email ?? null;
						this.dismissed = false;
						this.linkSent.set(false);
						this.resetResend();
					} else if ((user?.email ?? null) !== this.currentEmail) {
						// Same user, new address: whatever was sent (or is being sent) went to the old one.
						this.currentEmail = user?.email ?? null;
						this.linkSent.set(false);
						this.resetResend();
					}
					// Only ask the API when the loaded user says "unverified"; a verified user costs nothing.
					if (!user?.unverified) {
						return of(false);
					}
					this.email.set(user.email);
					return this.authService.getEmailVerificationStatus().pipe(
						tap((status) => this.linkSent.set(status?.verificationEmailSent === true)),
						map((status) => status?.isEmailVerified === false),
						// 404 = verification switched off on this deployment; anything else = unknown.
						catchError(() => of(false))
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((unverified: boolean) => this.visible.set(unverified && !this.dismissed));
	}

	/** Ask the API for a new verification email (it allows 3 a minute). */
	resend(): void {
		if (this.state() === 'sending') {
			return;
		}
		this.state.set('sending');
		this.errorMessage.set(null);
		// A re-read from an earlier failed attempt must not land on top of this attempt's answer.
		this.cancelRefresh();
		const askedFor = this.subjectKey();

		this.resendSubscription = this.authService
			.resendEmailVerificationLink()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					if (this.subjectKey() === askedFor) {
						this.linkSent.set(true);
						this.state.set('sent');
					}
				},
				error: (error: HttpErrorResponse) => {
					if (this.subjectKey() === askedFor) {
						this.onResendError(error, askedFor);
					}
				}
			});
	}

	/** Who and which address a resend answer belongs to. */
	private subjectKey(): string {
		return `${this.currentUserId ?? ''}|${this.currentEmail ?? ''}`;
	}

	dismiss(): void {
		this.dismissed = true;
		this.visible.set(false);
	}

	private resetResend(): void {
		this.cancelRefresh();
		this.resendSubscription?.unsubscribe();
		this.resendSubscription = null;
		this.state.set('idle');
		this.errorMessage.set(null);
	}

	/**
	 * Re-read whether a working link is out, after a resend the API did not complete. The API
	 * replaces the stored token and code before it sends, so a refused send can leave the link from
	 * an earlier email dead: "We sent you a link" may no longer be true. The answer is dropped when
	 * the user or address changed meanwhile or a newer resend started (it cancels this lookup), and a
	 * lookup that fails counts as "not sent": the notice must not vouch for a link it cannot confirm.
	 */
	private refreshLinkSent(askedFor: string): void {
		this.cancelRefresh();
		this.refreshSubscription = this.authService
			.getEmailVerificationStatus()
			.pipe(
				catchError(() => of(null)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((status) => {
				if (this.subjectKey() === askedFor) {
					this.linkSent.set(status?.verificationEmailSent === true);
				}
			});
	}

	private cancelRefresh(): void {
		this.refreshSubscription?.unsubscribe();
		this.refreshSubscription = null;
	}

	/** Only called while the user who asked is still the signed-in one (see `resend`). */
	private onResendError(error: HttpErrorResponse, askedFor: string): void {
		const apiMessage = typeof error?.error?.message === 'string' ? error.error.message : null;

		// Verified in another tab (or by code) since the page loaded: stop asking.
		if (error?.status === 400 && apiMessage && /already verified/i.test(apiMessage)) {
			const user = this.store.user;
			if (user) {
				this.store.user = { ...user, isEmailVerified: true };
			}
			this.visible.set(false);
			return;
		}

		this.state.set('error');
		if (error?.status === 429) {
			// Rejected by the rate limit before anything was attempted: nothing changed server-side.
			this.errorMessage.set(this.translate.instant('EMAIL_VERIFICATION.TOO_MANY_REQUESTS'));
			return;
		}
		this.refreshLinkSent(askedFor);
		if (apiMessage && (error.status === 503 || (error.status >= 400 && error.status < 500))) {
			// 503 carries "We could not send the verification email right now…", written for people.
			this.errorMessage.set(apiMessage);
		} else {
			this.errorMessage.set(this.translate.instant('EMAIL_VERIFICATION.RESEND_FAILED'));
		}
	}
}
