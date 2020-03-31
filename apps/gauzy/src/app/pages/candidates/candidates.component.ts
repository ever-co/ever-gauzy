import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { PermissionsEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { CandidateStatusComponent } from './table-components/candidate-status/candidate-status.component';
import { CandidatesService } from '../../@core/services/candidates.service';
import { CandidateFullNameComponent } from './table-components/candidate-fullname/candidate-fullname.component';

interface CandidateViewModel {
	fullName: string;
	email: string;
	id: string;
}

@Component({
	templateUrl: './candidates.component.html',
	styleUrls: ['./candidates.component.scss']
})
export class CandidatesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organizationName: string;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedCandidate: CandidateViewModel;
	selectedOrganizationId: string;

	private _ngDestroy$ = new Subject<void>();

	candidateName = 'Candidate';

	includeDeleted = false;
	loading = true;
	hasEditPermission = false;
	hasInviteEditPermission = false;
	hasInviteViewOrEditPermission = false;
	organizationInvitesAllowed = false;

	@ViewChild('candidatesTable', { static: false }) candidatesTable;

	constructor(
		private candidatesService: CandidatesService,
		private store: Store,
		private translate: TranslateService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_EMPLOYEES_EDIT
				);
				this.hasInviteEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_INVITE_EDIT
				);
				this.hasInviteViewOrEditPermission =
					this.store.hasPermission(PermissionsEnum.ORG_INVITE_VIEW) ||
					this.hasInviteEditPermission;
	
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					this.organizationInvitesAllowed =
						organization.invitesAllowed;
					this.loadPage();
				}
			});

		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	selectCandidateTmp(ev: {
		data: CandidateViewModel;
		isSelected: boolean;
		selected: CandidateViewModel[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedCandidate = ev.data;
			const checkName = this.selectedCandidate.fullName.trim();
			this.candidateName = checkName ? checkName : 'Candidate';
		} else {
			this.selectedCandidate = null;
		}
	}

	private async loadPage() {
		this.selectedCandidate = null;

		const { items } = await this.candidatesService
			.getAll(['user', 'tags'], {
				organization: { id: this.selectedOrganizationId }
			})
			.pipe(first())
			.toPromise();
		const { name } = this.store.selectedOrganization;

		let candidatesVm = [];
		const result = [];

		for (const candidate of items) {
			result.push({
				fullName: `${candidate.user.firstName} ${candidate.user.lastName}`,
				email: candidate.user.email,
				id: candidate.id,
				status: candidate.status,
				imageUrl: candidate.user.imageUrl,
				tag: candidate.tags
			});
		}

		if (!this.includeDeleted) {
			result.forEach((candidate) => {
				console.log(candidate);
				candidatesVm.push(candidate);
			});
		} else {
			candidatesVm = result;
		}

		this.sourceSmartTable.load(candidatesVm);

		if (this.candidatesTable) {
			this.candidatesTable.grid.dataSet.willSelect = 'false';
		}

		this.organizationName = name;

		this.loading = false;
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.FULL_NAME'),
					type: 'custom',
					renderComponent: CandidateFullNameComponent,
					class: 'align-row'
				},
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email',
					class: 'email-column'
				},
				source: {
					title: this.getTranslation('SM_TABLE.SOURCE'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					filter: false
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					renderComponent: CandidateStatusComponent,
					filter: false
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	changeIncludeDeleted(checked: boolean) {
		this.includeDeleted = checked;
		this.loadPage();
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadSmartTableSettings();
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
