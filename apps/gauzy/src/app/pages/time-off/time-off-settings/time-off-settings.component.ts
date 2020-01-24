import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../@core/services/auth.service';
import { TimeOffPolicy, RolesEnum } from '@gauzy/models';
import { first } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off/settings-mutation/time-off-settings-mutation.component';

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
export class TimeOffSettingsComponent implements OnInit {
	constructor(
		private dialogService: NbDialogService,
		private authService: AuthService
	) {}

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

	async addPolicy() {
		const result = await this.dialogService
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(first())
			.toPromise();
	}

	async editPolicy() {
		const result = await this.dialogService
			// TODO: add Policy as context here
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(first())
			.toPromise();
	}

	deletePolicy() {}
}
