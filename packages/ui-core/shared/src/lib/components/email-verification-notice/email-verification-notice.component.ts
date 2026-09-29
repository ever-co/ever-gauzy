import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbButtonModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
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
	/** Translation key of the explanation shown before the Resend button. */
	@Input() messageKey = 'EMAIL_VERIFICATION.NOTICE';

	readonly visible = signal(false);
	readonly state = signal<ResendState>('idle');
	readonly errorMessage = signal<string | null>(null);
	readonly email = signal<string | null>(null);

	private dismissed = false;
	/** The user the notice currently speaks for; a resend answer for anyone else is dropped. */
	private currentUserId: string | null = null;
	private resendSubscription: Subscription | null = null;

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
				distinctUntilChanged((a, b) => a?.id === b?.id && a?.unverified === b?.unverified),
				switchMap((user) => {
					// Another user signed in: forget the previous user's resend, including one in flight.
					if ((user?.id ?? null) !== this.currentUserId) {
						this.currentUserId = user?.id ?? null;
						this.resetResend();
					}
					// Only ask the API when the loaded user says "unverified"; a verified user costs nothing.
					if (!user?.unverified) {
						return of(false);
					}
					this.email.set(user.email);
					return this.authService.getEmailVerificationStatus().pipe(
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
		const askedFor = this.currentUserId;

		this.resendSubscription = this.authService
			.resendEmailVerificationLink()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					if (this.currentUserId === askedFor) {
						this.state.set('sent');
					}
				},
				error: (error: HttpErrorResponse) => {
					if (this.currentUserId === askedFor) {
						this.onResendError(error);
					}
				}
			});
	}

	dismiss(): void {
		this.dismissed = true;
		this.visible.set(false);
	}

	private resetResend(): void {
		this.resendSubscription?.unsubscribe();
		this.resendSubscription = null;
		this.state.set('idle');
		this.errorMessage.set(null);
	}

	/** Only called while the user who asked is still the signed-in one (see `resend`). */
	private onResendError(error: HttpErrorResponse): void {
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
			this.errorMessage.set(this.translate.instant('EMAIL_VERIFICATION.TOO_MANY_REQUESTS'));
		} else if (apiMessage && (error.status === 503 || (error.status >= 400 && error.status < 500))) {
			// 503 carries "We could not send the verification email right now…", written for people.
			this.errorMessage.set(apiMessage);
		} else {
			this.errorMessage.set(this.translate.instant('EMAIL_VERIFICATION.RESEND_FAILED'));
		}
	}
}
