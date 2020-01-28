import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../@core/services/auth.service';
import { TimeOffPolicy, RolesEnum } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off/settings-mutation/time-off-settings-mutation.component';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { Subject } from 'rxjs';

interface SelectedRowModel {
	data: TimeOffPolicy;
	isSelected: boolean;
	selected: TimeOffPolicy[];
	source: LocalDataSource;
}

@Component({
	selector: 'ga-time-off-settings',
	templateUrl: './time-off-settings.component.html',
	styleUrls: ['./time-off-settings.component.scss']
})
export class TimeOffSettingsComponent implements OnInit, OnDestroy {
	constructor(
		private dialogService: NbDialogService,
		private authService: AuthService,
		private toastrService: NbToastrService,
		private tymeOffService: TimeOffService
	) {}

	private _ngDestroy$ = new Subject<void>();
	hasRole: boolean;
	selectedPolicy: SelectedRowModel;
	smartTableSource = new LocalDataSource();
	loading = false;

	async ngOnInit() {
		this.hasRole = await this.authService
			.hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
			.pipe(first())
			.toPromise();
	}

	async openAddPolicyDialog() {
		this.dialogService
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				console.log(formData);

				if (formData) {
					await this.addPolicy(formData);
				}
			});
	}

	async addPolicy(formData) {
		if (formData) {
			try {
				console.log(formData);

				await this.tymeOffService.create(formData);

				this.toastrService.primary(
					'New Time off Policy created!',
					'Success'
				);
			} catch (err) {
				console.log(err);
			}
		}
	}

	async openEditPolicyDialog() {
		await this.dialogService
			// TODO: add Policy as context here
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.toPromise();
	}

	deletePolicy() {}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
