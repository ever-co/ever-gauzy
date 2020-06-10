import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyresultsComponent } from './edit-keyresults/edit-keyresults.component';
import { GoalDetailsComponent } from './goal-details/goal-details.component';

@Component({
	selector: 'ga-goals',
	templateUrl: './goals.component.html',
	styleUrls: ['./goals.component.scss']
})
export class GoalsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	loading = true;
	selectedOrganizationId: string;
	organizationName: string;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private store: Store,
		private translate: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					this.loadPage();
				}
			});
	}

	private async loadPage() {
		const { name } = this.store.selectedOrganization;

		this.loading = false;
		this.organizationName = name;
	}

	async addKeyResult() {
		const dialog = this.dialogService.open(EditKeyresultsComponent);

		const response = await dialog.onClose.pipe(first()).toPromise();
		console.log(response);
		if (response) {
			this.toastrService.primary('key result added', 'Success');
			this.loadPage();
		}
	}

	async createObjective() {
		const dialog = this.dialogService.open(EditObjectiveComponent);

		const response = await dialog.onClose.pipe(first()).toPromise();
		console.log(response);
		if (response) {
			this.toastrService.primary('Objective added', 'Success');
			this.loadPage();
		}
	}

	async openGoalDetials() {
		const dialog = this.dialogService.open(GoalDetailsComponent, {
			hasScroll: true
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		console.log(response);
		if (response) {
			this.toastrService.primary('Objective added', 'Success');
			this.loadPage();
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
