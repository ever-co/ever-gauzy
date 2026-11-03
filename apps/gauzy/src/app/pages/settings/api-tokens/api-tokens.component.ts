/**
 * Settings page: the signed-in user's own personal API tokens, which they hand to an agent or a script.
 *
 * Creating a token returns the plain value exactly once, and it goes straight to `ApiTokenSecretDialogComponent` so the
 * user can copy it before it is gone for good. Nothing else on this page ever holds it: the list only has the prefix.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EMPTY, Observable, Subject, Subscription } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ID, IUserApiToken, IUserApiTokenCreateInput, IUserApiTokenWithSecret } from '@gauzy/contracts';
import { UserApiTokenService } from '@gauzy/ui-core/core';
import { AlertModalComponent } from '@gauzy/ui-core/shared';
import { ApiTokenFormDialogComponent } from './api-token-form-dialog/api-token-form-dialog.component';
import { ApiTokenSecretDialogComponent } from './api-token-secret-dialog/api-token-secret-dialog.component';

@Component({
	selector: 'ngx-api-tokens',
	templateUrl: './api-tokens.component.html',
	styleUrls: ['./api-tokens.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiTokensComponent implements OnInit, OnDestroy {
	readonly tokens = signal<IUserApiToken[]>([]);
	readonly loading = signal(false);
	private readonly destroy$ = new Subject<void>();
	private listing?: Subscription;

	private readonly service = inject(UserApiTokenService);
	private readonly dialogService = inject(NbDialogService);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	ngOnInit(): void {
		this.loadTokens();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	loadTokens(): void {
		this.loading.set(true);
		// Only the newest read counts: an older answer must not bring back a token just revoked.
		this.listing?.unsubscribe();
		this.listing = this.service
			.list()
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: (result) => {
					this.tokens.set(result.items ?? []);
					this.loading.set(false);
				},
				error: () => {
					this.loading.set(false);
					this.toastError('USER_API_TOKENS.ERRORS.LOAD_FAILED');
				}
			});
	}

	openCreateDialog(): void {
		this.dialogService
			.open(ApiTokenFormDialogComponent)
			.onClose.pipe(
				filter((input: IUserApiTokenCreateInput) => !!input),
				switchMap((input: IUserApiTokenCreateInput) => this.service.create(input)),
				takeUntil(this.destroy$)
			)
			.subscribe({
				next: (created) => {
					this.toastr.success(
						this.translate.instant('USER_API_TOKENS.TOASTS.CREATED', { name: created.name }),
						this.translate.instant('TOASTR.TITLE.SUCCESS')
					);
					this.showSecret(created);
					this.loadTokens();
				},
				error: (error: HttpErrorResponse) => {
					// The form lets nothing else through, so a 400 is the limit on how many tokens one can hold.
					this.toastError(
						error?.status === 400
							? 'USER_API_TOKENS.ERRORS.TOO_MANY'
							: 'USER_API_TOKENS.ERRORS.CREATE_FAILED'
					);
				}
			});
	}

	revoke(token: IUserApiToken): void {
		this.openConfirmationDialog(this.translate.instant('USER_API_TOKENS.CONFIRM.REVOKE', { name: token.name }))
			.pipe(
				filter((answer) => answer === 'yes'),
				switchMap(() => this.service.revoke(token.id as ID)),
				takeUntil(this.destroy$)
			)
			.subscribe({
				next: () => {
					this.toastr.success(
						this.translate.instant('USER_API_TOKENS.TOASTS.REVOKED'),
						this.translate.instant('TOASTR.TITLE.SUCCESS')
					);
					this.loadTokens();
				},
				error: () => this.toastError('USER_API_TOKENS.ERRORS.REVOKE_FAILED')
			});
	}

	/** Whether a token has passed its expiry: it stays listed, as expired, until it is revoked. */
	hasExpired(token: IUserApiToken): boolean {
		return !!token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now();
	}

	trackById(_: number, token: IUserApiToken): string {
		return token.id as string;
	}

	/**
	 * Opens the shared yes/no dialog, which shows the sentence as it is. Wrapping it in an Observable keeps the chain
	 * inside one `takeUntil`.
	 *
	 * @returns `yes` or `no`, or nothing when the dialog is dismissed.
	 */
	private openConfirmationDialog(message: string): Observable<string | undefined> {
		const dialogRef = this.dialogService.open(AlertModalComponent, {
			context: {
				data: {
					title: this.translate.instant('USER_API_TOKENS.ACTIONS.REVOKE'),
					message,
					status: 'danger'
				}
			}
		});
		return dialogRef ? dialogRef.onClose : EMPTY;
	}

	/** Shows the plain token, this one time. The dialog cannot be dismissed by accident. */
	private showSecret(created: IUserApiTokenWithSecret): void {
		this.dialogService.open(ApiTokenSecretDialogComponent, {
			context: { created },
			closeOnBackdropClick: false,
			closeOnEsc: false
		});
	}

	private toastError(key: string): void {
		this.toastr.danger(this.translate.instant(key), this.translate.instant('TOASTR.TITLE.ERROR'));
	}
}
