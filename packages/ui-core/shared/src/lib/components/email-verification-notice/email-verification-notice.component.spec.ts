import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { AuthService, Store } from '@gauzy/ui-core/core';
import { EmailVerificationNoticeComponent } from './email-verification-notice.component';

/**
 * The notice must appear only for a signed-in user the API confirms is unverified, and never on a
 * deployment with verification switched off (the status endpoint answers 404 there).
 */
describe('EmailVerificationNoticeComponent', () => {
	const UNVERIFIED = { id: 'u1', email: 'jane@corp.co', isEmailVerified: false } as IUser;
	const VERIFIED = { id: 'u1', email: 'jane@corp.co', isEmailVerified: true } as IUser;

	function setup(options: {
		user: IUser | null;
		status?: () => Observable<{ isEmailVerified: boolean; verificationEmailSent?: boolean }>;
		resend?: () => Observable<Object>;
	}) {
		const user$ = new BehaviorSubject<IUser | null>(options.user);
		const store = {
			user$,
			get user() {
				return user$.value;
			},
			set user(value: IUser) {
				user$.next(value);
			}
		};
		const authService = {
			getEmailVerificationStatus: jest.fn(options.status ?? (() => of({ isEmailVerified: false }))),
			resendEmailVerificationLink: jest.fn(options.resend ?? (() => of({ status: 200 })))
		};

		TestBed.configureTestingModule({
			imports: [EmailVerificationNoticeComponent, TranslateModule.forRoot()],
			providers: [
				{ provide: Store, useValue: store },
				{ provide: AuthService, useValue: authService }
			]
		});
		TestBed.overrideComponent(EmailVerificationNoticeComponent, {
			set: { imports: [CommonModule, TranslateModule], schemas: [NO_ERRORS_SCHEMA] }
		});

		const fixture = TestBed.createComponent(EmailVerificationNoticeComponent);
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance, authService, user$ };
	}

	afterEach(() => TestBed.resetTestingModule());

	it('shows for a user the API confirms is unverified', () => {
		const { component, authService } = setup({ user: UNVERIFIED });
		expect(authService.getEmailVerificationStatus).toHaveBeenCalledTimes(1);
		expect(component.visible()).toBe(true);
	});

	it('stays hidden, without asking the API, for a verified user (control)', () => {
		const { component, authService } = setup({ user: VERIFIED });
		expect(authService.getEmailVerificationStatus).not.toHaveBeenCalled();
		expect(component.visible()).toBe(false);
	});

	it('stays hidden where verification is switched off (status answers 404)', () => {
		const { component } = setup({
			user: UNVERIFIED,
			status: () => throwError(() => new HttpErrorResponse({ status: 404 }))
		});
		expect(component.visible()).toBe(false);
	});

	it('hides once the signed-in user becomes verified (the confirm-email page updates the store)', () => {
		const { component, user$ } = setup({ user: UNVERIFIED });
		expect(component.visible()).toBe(true);
		user$.next(VERIFIED);
		expect(component.visible()).toBe(false);
	});

	it('shows the API message when the provider refused the resend', () => {
		const message = 'We could not send the verification email right now. Please try again in a few minutes.';
		const { component } = setup({
			user: UNVERIFIED,
			resend: () => throwError(() => new HttpErrorResponse({ status: 503, error: { message } }))
		});
		component.resend();
		expect(component.state()).toBe('error');
		expect(component.errorMessage()).toBe(message);
	});

	it('reports a successful resend', () => {
		const { component, authService } = setup({ user: UNVERIFIED });
		component.resend();
		expect(authService.resendEmailVerificationLink).toHaveBeenCalledTimes(1);
		expect(component.state()).toBe('sent');
	});

	it('drops a resend answer that arrives after another user signed in', () => {
		const pending = new Subject<Object>();
		const { component, user$ } = setup({ user: UNVERIFIED, resend: () => pending });
		component.resend();
		expect(component.state()).toBe('sending');

		user$.next({ id: 'u2', email: 'max@corp.co', isEmailVerified: false } as IUser);
		pending.next({ status: 200 });

		expect(component.state()).toBe('idle');
	});

	/**
	 * Production regression (2026-10-05): the notice told every unverified user "We sent a
	 * verification link to ...", including people invited years before verification existed who had
	 * never been sent one. It may only claim a link went out when the API says so.
	 */
	describe('says "we sent a link" only when one went out', () => {
		type Fixture = { detectChanges(): void; nativeElement: HTMLElement };

		/** The notice sentence (translation keys render as-is: no translations are loaded). */
		function noticeText(fixture: Fixture): string {
			fixture.detectChanges();
			return fixture.nativeElement.querySelector('.notice-text')?.textContent?.trim() ?? '';
		}

		/** The label of the send / resend button. */
		function sendButtonText(fixture: Fixture): string {
			fixture.detectChanges();
			const button = fixture.nativeElement.querySelector('button:not(.notice-dismiss)');
			return button?.textContent?.trim() ?? '';
		}

		it('offers to send a link when none was sent, and does not claim one was', () => {
			const { component, fixture } = setup({
				user: UNVERIFIED,
				status: () => of({ isEmailVerified: false, verificationEmailSent: false })
			});
			expect(component.visible()).toBe(true);
			expect(component.linkSent()).toBe(false);
			expect(noticeText(fixture)).toBe('EMAIL_VERIFICATION.NOTICE_NOT_SENT');
			expect(sendButtonText(fixture)).toBe('EMAIL_VERIFICATION.SEND');
		});

		it('says a link was sent, with Resend, when the API reports one (control)', () => {
			const { component, fixture } = setup({
				user: UNVERIFIED,
				status: () => of({ isEmailVerified: false, verificationEmailSent: true })
			});
			expect(component.linkSent()).toBe(true);
			expect(noticeText(fixture)).toBe('EMAIL_VERIFICATION.NOTICE');
			expect(sendButtonText(fixture)).toBe('EMAIL_VERIFICATION.RESEND');
		});

		it('treats an API without the field as "nothing sent"', () => {
			const { component } = setup({ user: UNVERIFIED, status: () => of({ isEmailVerified: false }) });
			expect(component.linkSent()).toBe(false);
		});

		it('switches to "we sent a link" once the user sends one', () => {
			const { component, fixture } = setup({
				user: UNVERIFIED,
				status: () => of({ isEmailVerified: false, verificationEmailSent: false })
			});
			component.resend();
			expect(component.state()).toBe('sent');
			expect(component.linkSent()).toBe(true);
			expect(noticeText(fixture)).toBe('EMAIL_VERIFICATION.NOTICE');
		});

		it('uses the wording the page passes in (Billing)', () => {
			const { component, fixture } = setup({
				user: UNVERIFIED,
				status: () => of({ isEmailVerified: false, verificationEmailSent: false })
			});
			component.notSentMessageKey = 'SETTINGS_MENU.BILLING_VERIFY_EMAIL_TO_LINK_NOT_SENT';
			expect(noticeText(fixture)).toBe('SETTINGS_MENU.BILLING_VERIFY_EMAIL_TO_LINK_NOT_SENT');
		});

		it('re-checks, with the new address, when the signed-in user changes their email', () => {
			let sent = true;
			const { component, authService, user$ } = setup({
				user: UNVERIFIED,
				status: () => of({ isEmailVerified: false, verificationEmailSent: sent })
			});
			expect(component.linkSent()).toBe(true);
			expect(authService.getEmailVerificationStatus).toHaveBeenCalledTimes(1);

			// Same user, new address: the link for the old one does not count for the new one.
			sent = false;
			user$.next({ ...UNVERIFIED, email: 'jane.new@corp.co' } as IUser);

			expect(authService.getEmailVerificationStatus).toHaveBeenCalledTimes(2);
			expect(component.email()).toBe('jane.new@corp.co');
			expect(component.linkSent()).toBe(false);
		});

		it('drops a resend answer for the previous address once the user changed it', () => {
			const pending = new Subject<Object>();
			const { component, user$ } = setup({
				user: UNVERIFIED,
				status: () => of({ isEmailVerified: false, verificationEmailSent: false }),
				resend: () => pending
			});
			component.resend();
			user$.next({ ...UNVERIFIED, email: 'jane.new@corp.co' } as IUser);
			pending.next({ status: 200 });

			expect(component.state()).toBe('idle');
			expect(component.linkSent()).toBe(false);
		});

		it('forgets the "sent" state of the previous user when another user signs in', () => {
			let sent = true;
			const { component, user$ } = setup({
				user: UNVERIFIED,
				status: () => of({ isEmailVerified: false, verificationEmailSent: sent })
			});
			expect(component.linkSent()).toBe(true);
			sent = false;
			user$.next({ id: 'u2', email: 'max@corp.co', isEmailVerified: false } as IUser);
			expect(component.linkSent()).toBe(false);
		});
	});

	it('keeps a dismissal to the user who dismissed it', () => {
		const { component, user$ } = setup({ user: UNVERIFIED });
		component.dismiss();
		expect(component.visible()).toBe(false);

		user$.next({ id: 'u2', email: 'max@corp.co', isEmailVerified: false } as IUser);
		expect(component.visible()).toBe(true);
	});

	it('treats "already verified" as done and hides itself', () => {
		const { component } = setup({
			user: UNVERIFIED,
			resend: () =>
				throwError(
					() => new HttpErrorResponse({ status: 400, error: { message: 'Your email is already verified.' } })
				)
		});
		component.resend();
		expect(component.visible()).toBe(false);
	});
});
