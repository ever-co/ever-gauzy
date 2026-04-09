/**
 * Admin page: list + manage registered third-party OAuth clients.
 *
 * This is the admin entry point a tenant SUPER_ADMIN / ADMIN uses to
 * register apps like Activepieces, n8n, or Make.com against the multi-app
 * OAuth provider. It backs the `/pages/settings/oauth-clients` route and
 * is guarded by `PermissionsEnum.OAUTH_CLIENT_VIEW`.
 *
 * Create and "rotate secret" flows both return the plaintext client
 * secret exactly once — we immediately hand that off to
 * `OAuthClientSecretDialogComponent` so the admin can copy it before it
 * is gone forever.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject, EMPTY, Observable } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ID, IOAuthClient, IOAuthClientWithSecret } from '@gauzy/contracts';
import { OAuthClientManagementService } from '@gauzy/ui-core/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';
import { OAuthClientFormDialogComponent } from './oauth-client-form-dialog/oauth-client-form-dialog.component';
import { OAuthClientSecretDialogComponent } from './oauth-client-secret-dialog/oauth-client-secret-dialog.component';

@Component({
	selector: 'ngx-oauth-clients',
	templateUrl: './oauth-clients.component.html',
	styleUrls: ['./oauth-clients.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OAuthClientsComponent implements OnInit, OnDestroy {
	clients: IOAuthClient[] = [];
	loading = false;
	private readonly destroy$ = new Subject<void>();

	private readonly service = inject(OAuthClientManagementService);
	private readonly dialogService = inject(NbDialogService);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);
	private readonly cdr = inject(ChangeDetectorRef);

	ngOnInit(): void {
		this.loadClients();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	loadClients(): void {
		this.loading = true;
		this.service
			.list({ skip: 0, take: 100 })
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: (result) => {
					this.clients = result.items ?? [];
					this.loading = false;
					this.cdr.markForCheck();
				},
				error: () => {
					this.loading = false;
					this.cdr.markForCheck();
					this.toastr.danger(
						this.translate.instant('OAUTH_CLIENTS.ERRORS.LOAD_FAILED'),
						this.translate.instant('TOASTR.TITLE.ERROR')
					);
				}
			});
	}

	openCreateDialog(): void {
		this.dialogService
			.open(OAuthClientFormDialogComponent, { context: { client: null } })
			.onClose.pipe(
				filter((result) => !!result),
				switchMap((result) => this.service.create(result)),
				takeUntil(this.destroy$)
			)
			.subscribe({
				next: (created) => {
					this.toastr.success(
						this.translate.instant('OAUTH_CLIENTS.TOASTS.CREATED', { name: created.name }),
						this.translate.instant('TOASTR.TITLE.SUCCESS')
					);
					this.showSecret(created);
					this.loadClients();
				},
				error: () => {
					this.toastr.danger(
						this.translate.instant('OAUTH_CLIENTS.ERRORS.CREATE_FAILED'),
						this.translate.instant('TOASTR.TITLE.ERROR')
					);
				}
			});
	}

	openEditDialog(client: IOAuthClient): void {
		this.dialogService
			.open(OAuthClientFormDialogComponent, { context: { client } })
			.onClose.pipe(
				filter((result) => !!result),
				switchMap((result) => this.service.update(client.id as ID, result)),
				takeUntil(this.destroy$)
			)
			.subscribe({
				next: () => {
					this.toastr.success(
						this.translate.instant('OAUTH_CLIENTS.TOASTS.UPDATED'),
						this.translate.instant('TOASTR.TITLE.SUCCESS')
					);
					this.loadClients();
				},
				error: () => {
					this.toastr.danger(
						this.translate.instant('OAUTH_CLIENTS.ERRORS.UPDATE_FAILED'),
						this.translate.instant('TOASTR.TITLE.ERROR')
					);
				}
			});
	}

	rotateSecret(client: IOAuthClient): void {
		this.openConfirmationDialog()
			.pipe(
				filter((confirmed) => !!confirmed),
				switchMap(() => this.service.rotateSecret(client.id as ID)),
				takeUntil(this.destroy$)
			)
			.subscribe({
				next: (rotated) => {
					this.toastr.success(
						this.translate.instant('OAUTH_CLIENTS.TOASTS.SECRET_ROTATED'),
						this.translate.instant('TOASTR.TITLE.SUCCESS')
					);
					this.showSecret(rotated);
				},
				error: () => {
					this.toastr.danger(
						this.translate.instant('OAUTH_CLIENTS.ERRORS.ROTATE_FAILED'),
						this.translate.instant('TOASTR.TITLE.ERROR')
					);
				}
			});
	}

	delete(client: IOAuthClient): void {
		this.openConfirmationDialog()
			.pipe(
				filter((confirmed) => !!confirmed),
				switchMap(() => this.service.delete(client.id as ID)),
				takeUntil(this.destroy$)
			)
			.subscribe({
				next: () => {
					this.toastr.success(
						this.translate.instant('OAUTH_CLIENTS.TOASTS.DELETED'),
						this.translate.instant('TOASTR.TITLE.SUCCESS')
					);
					this.loadClients();
				},
				error: () => {
					this.toastr.danger(
						this.translate.instant('OAUTH_CLIENTS.ERRORS.DELETE_FAILED'),
						this.translate.instant('TOASTR.TITLE.ERROR')
					);
				}
			});
	}

	/**
	 * Open the shared `DeleteConfirmationComponent` for the destructive
	 * row actions (revoke / rotate). Wrapping the dialog in an Observable
	 * keeps the entire chain inside one `takeUntil(this.destroy$)` so
	 * callbacks can't fire on a destroyed component.
	 */
	private openConfirmationDialog(): Observable<boolean> {
		const dialogRef = this.dialogService.open(DeleteConfirmationComponent);
		return dialogRef ? dialogRef.onClose : EMPTY;
	}

	copyClientId(clientId: string): void {
		if (!navigator?.clipboard?.writeText) {
			return;
		}
		navigator.clipboard
			.writeText(clientId)
			.then(() => {
				this.toastr.success(
					this.translate.instant('OAUTH_CLIENTS.TOASTS.CLIENT_ID_COPIED'),
					this.translate.instant('TOASTR.TITLE.SUCCESS')
				);
			})
			.catch(() => {
				this.toastr.danger(
					this.translate.instant('OAUTH_CLIENTS.ERRORS.COPY_FAILED'),
					this.translate.instant('TOASTR.TITLE.ERROR')
				);
			});
	}

	trackById(_: number, client: IOAuthClient): string {
		return (client.id as string) ?? client.clientId;
	}

	/**
	 * Surface the plaintext secret returned by create/rotate. Shown
	 * exactly once; once the dialog closes the secret is unrecoverable.
	 */
	private showSecret(client: IOAuthClientWithSecret): void {
		this.dialogService.open(OAuthClientSecretDialogComponent, {
			context: { client },
			closeOnBackdropClick: false,
			closeOnEsc: false
		});
	}
}
