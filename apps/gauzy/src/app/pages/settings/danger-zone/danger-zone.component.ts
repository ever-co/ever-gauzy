import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DangerZoneMutationComponent } from '../../../@shared/settings/danger-zone-mutation/danger-zone-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { UsersService } from '../../../@core/services';
import { Store } from '../../../@core/services/store.service';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ToastrService } from '../../../@core/services/toastr.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IUser } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Environment } from '../../../../environments/model';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-danger-zone',
	templateUrl: './danger-zone.component.html'
})
export class DangerZoneComponent
	extends TranslationBaseComponent
	implements OnInit {
	
	environment: Environment = environment;
	user: IUser;
	loading: boolean;
	process: number = 0;

	constructor(
		readonly translate: TranslateService,
		private dialogService: NbDialogService,
		private userService: UsersService,
		private store: Store,
		private toastrService: ToastrService,
		private router: Router
	) {
		super(translate);
	}

	async deleteAccount() {
		this.dialogService
			.open(DangerZoneMutationComponent, {
				context: {
					recordType: this.getTranslation(
						'NOTES.DANGER_ZONE.TITLES.ACCOUNT'
					),
					title: this.getTranslation(
						'FORM.DELETE_CONFIRMATION.DELETE_ACCOUNT'
					)
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (data) {
					try {
						await this.userService
							.getUserById(this.store.userId)
							.then((user) => {
								this.userService.delete(
									this.store.userId,
									data.user
								);

								this.toastrService.success(
									this.getTranslation(
										'NOTES.DANGER_ZONE.ACCOUNT_DELETED',
										{
											username:
												user.firstName +
												' ' +
												user.lastName
										}
									)
								);
							})
							.then(() => {
								setTimeout(() => {
									this.router.navigate(['/auth/register']);
								}, 2500);
							});
					} catch (error) {
						this.toastrService.danger(
							this.getTranslation(
								'NOTES.ORGANIZATIONS.DATA_ERROR',
								{ error: error.error.message || error.message }
							)
						);
					}
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
					recordType: this.getTranslation(
						'NOTES.DANGER_ZONE.TITLES.ALL_DATA'
					),
					title: this.getTranslation(
						'FORM.DELETE_CONFIRMATION.REMOVE_ALL_DATA'
					)
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (data) {
					try {
						this.loading = true;
						this.process = 0;
						setTimeout(() => { this.process = 20; }, 200); 
						setTimeout(() => { this.process = 50; }, 200);

						const { id: userId } = this.user;
						this.userService
							.deleteAllData(userId)
							.then((organization: any) => {
								if (organization) {
									this.store.selectedOrganization = organization;
									this.store.organizationId = organization.id;
									this.store.selectedEmployee = null;

									this.toastrService.success(
										this.getTranslation(
											'NOTES.DANGER_ZONE.ALL_DATA_DELETED',
										)
									);
								}
								this.process = 80
								setTimeout(() => { this.process = 100 }, 200);
							}).finally(() => {
								this.loading = false;
							});
					} catch (error) {
						this.toastrService.danger(
							this.getTranslation(
								'NOTES.ORGANIZATIONS.DATA_ERROR',
								{ error: error.error.message || error.message }
							)
						);
					}
				}
			});
	}

	ngOnDestroy() { }
}
