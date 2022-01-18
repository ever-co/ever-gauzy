import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	InvitationTypeEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	ICandidateViewModel,
	ICandidate,
	CandidateStatusEnum
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { firstValueFrom, Subject } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { Router, ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslationBaseComponent } from '../../@shared/language-base';
import { CandidateMutationComponent } from '../../@shared/candidate/candidate-mutation/candidate-mutation.component';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { DateViewComponent, PictureNameTagsComponent } from '../../@shared/table-components';
import { ArchiveConfirmationComponent, CandidateActionConfirmationComponent } from '../../@shared/user/forms';
import { ComponentEnum } from '../../@core/constants';
import { CandidatesService, ErrorHandlingService, Store, ToastrService } from '../../@core/services';
import { CandidateStatusComponent, CandidateSourceComponent } from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './candidates.component.html',
	styleUrls: ['./candidates.component.scss']
})
export class CandidatesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedCandidate: ICandidateViewModel;
	includeArchived: boolean = false;
	loading: boolean;
	organizationInvitesAllowed: boolean = false;
	viewComponentName: ComponentEnum;
	disableButton: boolean = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	candidateStatusEnum = CandidateStatusEnum;
	candidates: ICandidateViewModel[] = [];

	public organization: IOrganization;
	candidates$: Subject<any> = new Subject();

	candidatesTable: Ng2SmartTableComponent;
	@ViewChild('candidatesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.candidatesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly candidatesService: CandidatesService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.candidates$
			.pipe(
				debounceTime(100),
				tap(() => this.loading = true),
				tap(() => this.getCandidates()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => this.organization = organization),
				tap(({ invitesAllowed }: IOrganization) => this.organizationInvitesAllowed = invitesAllowed),
				tap(() => this.candidates$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	goTo(page: string) {
		this.router.navigate([`/pages/employees/candidates/${page}`]);
	}

	setView() {
		this.viewComponentName = ComponentEnum.CANDIDATES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.candidatesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	selectCandidate({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedCandidate = isSelected ? data : null;
	}

	async add() {
		try {
			const { name } = this.organization;
			const dialog = this.dialogService.open(CandidateMutationComponent);
			const candidates: ICandidate[] = await firstValueFrom(dialog.onClose);
	
			if (candidates) {
				for await (const candidate of candidates) {
					if (candidate.user) {
						const { firstName, lastName } = candidate.user;
						this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_CREATED', {
							name: `${firstName.trim()} ${lastName.trim()}`,
							organization: name
						});
					}
				}
			}	
		} catch (error) {
			console.log('Error, while creating bulk candidate', error);
		} finally {
			this.candidates$.next(true);
		}
	}

	edit(selectedItem?: ICandidateViewModel) {
		if (selectedItem) {
			this.selectCandidate({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.selectedCandidate) {
			return;
		}
		this.router.navigate([
			'/pages/employees/candidates/edit/' +
			this.selectedCandidate.id +
			'/profile'
		]);
	}

	async archive(selectedItem?: ICandidateViewModel) {
		if (selectedItem) {
			this.selectCandidate({
				isSelected: true,
				data: selectedItem
			});
		}
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
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { id, fullName } = this.selectedCandidate;
						await this.candidatesService.setCandidateAsArchived(id);

						this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_ARCHIVED', {
							name: fullName
						});
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this.candidates$.next(true);
					}
				}
			});
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.CANDIDATE
			}
		});
		await firstValueFrom(dialog.onClose);
	}

	manageInvites() {
		this.router.navigate(['/pages/employees/candidates/invites']);
	}

	manageInterviews() {
		this.router.navigate(['/pages/employees/candidates/interviews']);
	}

	private async getCandidates() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await firstValueFrom(this.candidatesService.getAll(['user', 'source', 'tags'], {
			organizationId,
			tenantId
		}));

		let candidates = [];
		const result = [];
		for (const candidate of items) {
			result.push({
				fullName: candidate.user.name,
				email: candidate.user.email,
				id: candidate.id,
				source: candidate.source,
				rating: candidate.ratings,
				status: candidate.status,
				isArchived: candidate.isArchived,
				imageUrl: candidate.user.imageUrl,
				tags: candidate.tags,
				hiredDate: candidate.hiredDate,
				rejectDate: candidate.rejectDate
			});
		}

		if (!this.includeArchived) {
			result.forEach((candidate) => {
				if (!candidate.isArchived) {
					candidates.push(candidate);
				}
			});
		} else {
			candidates = result;
		}

		this.candidates = candidates;
		this.sourceSmartTable.load(candidates);
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
				hiredDate: {
					title: this.getTranslation('SM_TABLE.HIRED_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
				},
				rejectDate: {
					title: this.getTranslation('SM_TABLE.REJECTED_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
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
		this.candidates$.next(true);
	}

	async reject(selectedItem?: ICandidateViewModel) {
		if (selectedItem) {
			this.selectCandidate({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(CandidateActionConfirmationComponent, {
				context: {
					recordType: this.selectedCandidate.fullName,
					isReject: true
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { id, fullName } = this.selectedCandidate;
						await this.candidatesService.setCandidateAsRejected(id);

						this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_REJECTED', {
							name: fullName
						});
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this.candidates$.next(true);
					}
				}
			});
	}

	async hire(selectedItem?: ICandidateViewModel) {
		if (selectedItem) {
			this.selectCandidate({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(CandidateActionConfirmationComponent, {
				context: {
					recordType: this.selectedCandidate.fullName,
					isReject: false
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { id, fullName } = this.selectedCandidate;
						await this.candidatesService.setCandidateAsHired(id);

						this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_HIRED', {
							name: fullName
						});
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this.candidates$.next(true);
					}
				}
			});
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectCandidate({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.candidatesTable && this.candidatesTable.grid) {
			this.candidatesTable.grid.dataSet['willSelect'] = 'false';
			this.candidatesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() { }
}
