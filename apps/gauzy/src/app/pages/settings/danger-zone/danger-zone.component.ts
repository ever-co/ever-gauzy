import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { AccountDeletionOutcomeEnum, IUser } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Environment, environment } from '@gauzy/ui-config';
import { Store, ToastrService, UsersService } from '@gauzy/ui-core/core';
import { DangerZoneMutationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-danger-zone',
    templateUrl: './danger-zone.component.html',
    styleUrls: ['./danger-zone.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DangerZoneComponent extends TranslationBaseComponent implements OnInit {
	environment: Environment = environment;
	user: IUser;
	loading: boolean;
	process: number = 0;

	constructor(
		public readonly translate: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly userService: UsersService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly router: Router
	) {
		super(translate);
	}

	async deleteAccount() {
		// What the API will do, so the dialog can say it: the whole workspace when the user is its only member.
		let consequence = '';
		try {
			const preview = await this.userService.previewMyAccountDeletion();
			const account = preview.accounts?.[0];
			if (account) {
				consequence =
					account.outcome === AccountDeletionOutcomeEnum.WORKSPACE_DELETED
						? this.getTranslation('DELETE_ACCOUNT_PAGE.CONFIRM.OUTCOME_WORKSPACE')
						: this.getTranslation('DELETE_ACCOUNT_PAGE.CONFIRM.OUTCOME_ACCOUNT', {
								members: account.otherMembers
						  });
				if (account.soleAdmin) {
					consequence += ' ' + this.getTranslation('DELETE_ACCOUNT_PAGE.CONFIRM.SOLE_ADMIN');
				}
			}
		} catch {
			// The dialog still opens; the API decides when the user confirms.
		}

		this.dialogService
			.open(DangerZoneMutationComponent, {
				context: {
					recordType: this.getTranslation('NOTES.DANGER_ZONE.TITLES.ACCOUNT'),
					title: [this.getTranslation('FORM.DELETE_CONFIRMATION.DELETE_ACCOUNT'), consequence]
						.filter(Boolean)
						.join(' ')
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (!data) {
					return;
				}
				try {
					const user = await this.userService.getUserById(this.store.userId);
					// `/account-deletion/me`, not `DELETE /user/:id`: it also deletes a workspace nobody else uses
					// (and its files) instead of leaving it behind, and emails a confirmation. Awaited: the success
					// message and the sign-out used to run even when the API refused.
					await this.userService.deleteMyAccount();

					this.toastrService.success(
						this.getTranslation('NOTES.DANGER_ZONE.ACCOUNT_DELETED', {
							username: user.firstName + ' ' + user.lastName
						})
					);
					// The account is gone: drop the session this browser still holds, then leave the app.
					setTimeout(() => {
						this.router.navigate(['/auth/logout']);
					}, 2500);
				} catch (error) {
					this.toastrService.danger(
						this.getTranslation('NOTES.ORGANIZATIONS.DATA_ERROR', {
							error: error?.error?.message || error?.message
						})
					);
				}
			});
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user))
			)
			.subscribe();
	}

	deleteAllData() {
		this.dialogService
			.open(DangerZoneMutationComponent, {
				context: {
					recordType: this.getTranslation('NOTES.DANGER_ZONE.TITLES.ALL_DATA'),
					title: this.getTranslation('FORM.DELETE_CONFIRMATION.REMOVE_ALL_DATA')
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (data) {
					try {
						this.loading = true;
						this.process = 0;
						setTimeout(() => {
							this.process = 20;
						}, 200);
						setTimeout(() => {
							this.process = 50;
						}, 200);

						await this.userService
							.deleteAllData()
							.then((organization: any) => {
								if (organization) {
									this.store.selectedOrganization = organization;
									this.store.organizationId = organization.id;
									this.store.selectedEmployee = null;

									this.toastrService.success(
										this.getTranslation('NOTES.DANGER_ZONE.ALL_DATA_DELETED')
									);
								}
								this.process = 80;
								setTimeout(() => {
									this.process = 100;
								}, 200);
							})
							.finally(() => {
								this.loading = false;
							});
					} catch (error) {
						this.process = 0;
						this.toastrService.danger(
							this.getTranslation('NOTES.ORGANIZATIONS.DATA_ERROR', {
								error: error?.error?.message || error?.message
							})
						);
					}
				}
			});
	}

	ngOnDestroy() {}
}
