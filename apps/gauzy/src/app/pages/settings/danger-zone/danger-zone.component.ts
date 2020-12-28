import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DangerZoneMutationComponent } from '../../../@shared/settings/danger-zone-mutation/danger-zone-mutation.component';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { UsersService } from '../../../@core/services';
import { Store } from '../../../@core/services/store.service';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ToastrService } from '../../../@core/services/toastr.service';

@Component({
	selector: 'ga-danger-zone',
	templateUrl: './danger-zone.component.html'
})
export class DangerZoneComponent
	extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

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
						'NOTES.DANGER_ZONE.RECORD_TYPE'
					)
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
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

	ngOnInit() {}

	ngOnDestroy() {}
}
