import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { PermissionsEnum, InvitationTypeEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { CandidateStatusComponent } from './table-components/candidate-status/candidate-status.component';
import { CandidatesService } from '../../@core/services/candidates.service';
import { CandidateMutationComponent } from '../../@shared/candidate/candidate-mutation/candidate-mutation.component';
import { NbToastrService, NbDialogService, NbMenuItem } from '@nebular/theme';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { Router, ActivatedRoute } from '@angular/router';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { CandidateSourceComponent } from './table-components/candidate-source/candidate-source.component';
import { CandidateSourceService } from '../../@core/services/candidate-source.service';
import { CandidateFeedbacksService } from '../../@core/services/candidate-feedbacks.service';
import { ArchiveConfirmationComponent } from '../../@shared/user/forms/archive-confirmation/archive-confirmation.component';
import { CandidateActionConfirmationComponent } from '../../@shared/user/forms/candidate-action-confirmation/candidate-action-confirmation.component';

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

	candidateSource: string;
	candidateRating: number;

	includeArchived = false;
	loading = true;
	hasEditPermission = false;
	hasInviteEditPermission = false;
	hasInviteViewOrEditPermission = false;
	organizationInvitesAllowed = false;

	@ViewChild('candidatesTable') candidatesTable;
	supportContextMenu: NbMenuItem[];

	constructor(
		private candidatesService: CandidatesService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private store: Store,
		private router: Router,
		private route: ActivatedRoute,
		private translate: TranslateService,
		private errorHandler: ErrorHandlingService,
		private candidateSourceService: CandidateSourceService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_CANDIDATES_EDIT
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
		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.add();
				}
			});
		this.supportContextMenu = [
			{
				title: this.getTranslation('CONTEXT_MENU.MANAGE_INTERVIEWS'),
				icon: 'people-outline',
				link: 'pages/employees/candidates/interviews'
			},
			{
				title: this.getTranslation('CONTEXT_MENU.MANAGE_INVITES'),
				icon: 'email-outline',
				link: 'pages/employees/candidates/invites'
			},
			{
				title: this.getTranslation('CONTEXT_MENU.CANDIDATE_STATISTIC'),
				icon: 'bar-chart-outline',
				link: 'pages/employees/candidates/statistic'
			},
			{
				title: this.getTranslation('CONTEXT_MENU.CANDIDATE_CRITERIONS'),
				icon: 'options-2-outline',
				link: 'pages/employees/candidates/criterions'
			}
		];
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
	async add() {
		const dialog = this.dialogService.open(CandidateMutationComponent);

		const response = await dialog.onClose.pipe(first()).toPromise();

		if (response) {
			response.map((data) => {
				if (data.user.firstName || data.user.lastName) {
					this.candidateName =
						data.user.firstName + ' ' + data.user.lastName;
				}
				this.toastrService.primary(
					this.candidateName.trim() +
						' added to ' +
						data.organization.name,
					'Success'
				);
			});

			this.loadPage();
		}
	}
	edit() {
		this.router.navigate([
			'/pages/employees/candidates/edit/' + this.selectedCandidate.id
		]);
	}
	async archive() {
		this.dialogService
			.open(ArchiveConfirmationComponent, {
				context: {
					recordType:
						this.selectedCandidate.fullName +
						' ' +
						this.getTranslation(
							'FORM.ARCHIVE_CONFIRMATION.CANDIDATE'
						)
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.candidatesService.setCandidateAsArchived(
							this.selectedCandidate.id
						);

						this.toastrService.primary(
							this.candidateName + '  set as archived.',
							'Success'
						);

						this.loadPage();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}
	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.CANDIDATE,
				selectedOrganizationId: this.selectedOrganizationId,
				currentUserId: this.store.userId
			}
		});
		await dialog.onClose.pipe(first()).toPromise();
	}
	manageInvites() {
		this.router.navigate(['/pages/employees/candidates/invites']);
	}
	manageInterviews() {
		this.router.navigate(['/pages/employees/candidates/interviews']);
	}
	async getCandidateSource(id: string) {
		this.candidateSource = null;
		const res = await this.candidateSourceService.getAll({
			candidateId: id
		});
		if (res) {
			return (this.candidateSource = res.items[0]);
		}
	}
	async getCandidateRating(id: string) {
		const res = await this.candidateFeedbacksService.getAll(
			['interviewer'],
			{
				candidateId: id
			}
		);
		if (res) {
			this.candidateRating = 0;
			for (let i = 0; i < res.total; i++) {
				this.candidateRating += +res.items[i].rating / res.total;
			}
		}
	}
	private async loadPage() {
		this.selectedCandidate = null;

		const { items } = await this.candidatesService
			.getAll(['user', 'source', 'tags'], {
				organization: { id: this.selectedOrganizationId }
			})
			.pipe(first())
			.toPromise();
		const { name } = this.store.selectedOrganization;

		let candidatesVm = [];
		const result = [];

		for (const candidate of items) {
			await this.getCandidateSource(candidate.id);
			await this.getCandidateRating(candidate.id);
			result.push({
				fullName: `${candidate.user.firstName} ${candidate.user.lastName}`,
				email: candidate.user.email,
				id: candidate.id,
				source: this.candidateSource,
				rating: this.candidateRating,
				status: candidate.status,
				isArchived: candidate.isArchived,
				imageUrl: candidate.user.imageUrl,
				tags: candidate.tags
			});
		}
		if (!this.includeArchived) {
			result.forEach((candidate) => {
				if (!candidate.isArchived) {
					candidatesVm.push(candidate);
				}
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
					renderComponent: PictureNameTagsComponent,
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
					renderComponent: CandidateSourceComponent,
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

	changeIncludeArchived(checked: boolean) {
		this.includeArchived = checked;
		this.loadPage();
	}
	async reject() {
		this.dialogService
			.open(CandidateActionConfirmationComponent, {
				context: {
					recordType: this.selectedCandidate.fullName,
					isReject: true
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.candidatesService.setCandidateAsRejected(
							this.selectedCandidate.id
						);

						this.toastrService.success(
							this.candidateName + '  set as rejected.',
							'Success'
						);

						this.loadPage();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}
	async hire() {
		this.dialogService
			.open(CandidateActionConfirmationComponent, {
				context: {
					recordType: this.selectedCandidate.fullName,
					isReject: false
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.candidatesService.setCandidateAsHired(
							this.selectedCandidate.id
						);

						this.toastrService.success(
							this.candidateName + '  set as hired.',
							'Success'
						);

						this.loadPage();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
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
