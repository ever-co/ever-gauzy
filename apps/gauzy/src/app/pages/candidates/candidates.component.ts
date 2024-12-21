import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	InvitationTypeEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	ICandidateViewModel,
	ICandidate,
	CandidateStatusEnum
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Cell } from 'angular2-smart-table';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { firstValueFrom, Subject } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { Router, ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import { CandidatesService, ErrorHandlingService, ServerDataSource, Store, ToastrService } from '@gauzy/ui-core/core';
import {
	PaginationFilterBaseComponent,
	IPaginationBase,
	PictureNameTagsComponent,
	DateViewComponent,
	TagsOnlyComponent,
	ArchiveConfirmationComponent,
	CandidateActionConfirmationComponent,
	InviteMutationComponent,
	InputFilterComponent,
	CandidateMutationComponent
} from '@gauzy/ui-core/shared';
import { CandidateStatusComponent, CandidateSourceComponent } from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
    templateUrl: './candidates.component.html',
    styleUrls: ['./candidates.component.scss'],
    standalone: false
})
export class CandidatesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	includeArchived: boolean = false;
	loading: boolean = false;
	organizationInvitesAllowed: boolean = false;
	disableButton: boolean = true;
	settingsSmartTable: object;
	sourceSmartTable: ServerDataSource;
	selectedCandidate: ICandidateViewModel;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	candidateStatusEnum = CandidateStatusEnum;
	candidates: ICandidateViewModel[] = [];
	public organization: IOrganization;
	public candidates$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly candidatesService: CandidatesService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly http: HttpClient
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
				tap(() => this._clearItem()),
				tap(() => this.getCandidates()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this.candidates$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(({ invitesAllowed }: IOrganization) => (this.organizationInvitesAllowed = invitesAllowed)),
				tap(() => this._refresh$.next(true)),
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
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.candidates = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 * @param page
	 */
	goTo(page: string) {
		this.router.navigate([`/pages/employees/candidates/${page}`]);
	}

	/**
	 *
	 */
	setView() {
		this.viewComponentName = ComponentEnum.CANDIDATES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.candidates = [])),
				tap(() => this.candidates$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 * @param param0
	 */
	selectCandidate({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedCandidate = isSelected ? data : null;
	}

	/**
	 *
	 */
	async add() {
		try {
			const { name } = this.organization;
			const dialog = this.dialogService.open(CandidateMutationComponent);
			const candidates: ICandidate[] = await firstValueFrom(dialog.onClose);

			if (candidates) {
				for await (const candidate of candidates) {
					if (candidate.user) {
						const { firstName, lastName } = candidate.user;
						let fullName = 'Candidate';
						if (firstName || lastName) {
							fullName = `${firstName} ${lastName}`;
						}
						this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_CREATED', {
							name: fullName,
							organization: name
						});
					}
				}
				this.candidates$.next(true);
			}
		} catch (error) {
			console.log('Error, while creating bulk candidate', error);
		}
	}

	/**
	 *
	 * @param selectedItem
	 * @returns
	 */
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

		const candidateId = this.selectedCandidate.id;
		this.router.navigate(['/pages/employees/candidates/edit', candidateId, 'profile']);
	}

	/**
	 *
	 */
	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.CANDIDATE
			}
		});
		await firstValueFrom(dialog.onClose);
	}

	/**
	 *
	 */
	manageInvites() {
		this.router.navigate(['/pages/employees/candidates/invites']);
	}

	/**
	 *
	 */
	manageInterviews() {
		this.router.navigate(['/pages/employees/candidates/interviews']);
	}

	/**
	 *
	 * @returns
	 */
	private setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		this.loading = true;
		const { id: organizationId, tenantId } = this.organization;

		this.sourceSmartTable = new ServerDataSource(this.http, {
			endPoint: API_PREFIX + '/candidate/pagination',
			relations: ['user', 'source', 'tags'],
			join: {
				alias: 'candidate',
				leftJoin: {
					user: 'candidate.user'
				},
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				organizationId,
				tenantId,
				isArchived: !this.includeArchived,
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (candidate: ICandidate) => {
				return Object.assign({}, candidate, {
					fullName: candidate.user.name,
					email: candidate.user.email,
					id: candidate.id,
					source: candidate.source,
					rating: candidate.ratings,
					status: candidate.status,
					isArchived: candidate.isArchived,
					imageUrl: candidate.user.imageUrl,
					tags: candidate.tags,
					appliedDate: candidate.appliedDate,
					hiredDate: candidate.hiredDate,
					rejectDate: candidate.rejectDate
				});
			},
			finalize: () => {
				if (this._isGridLayout) this.candidates.push(...this.sourceSmartTable.getData());
				this.setPagination({
					...this.getPagination(),
					totalItems: this.sourceSmartTable.count()
				});
				this.loading = false;
			}
		});
	}

	/**
	 *
	 */
	private get _isGridLayout(): boolean {
		return this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID;
	}

	/**
	 * GET all candidates lists
	 *
	 * @returns
	 */
	private async getCandidates() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();
			this.sourceSmartTable.setPaging(activePage, itemsPerPage, false);

			if (this._isGridLayout) this._loadCardLayoutData();
		} catch (error) {
			this.toastrService.danger(error, this.getTranslation('TOASTR.TITLE.ERROR'));
		}
	}

	/**
	 * GET CARD Layout candidates lists
	 */
	private async _loadCardLayoutData() {
		try {
			await this.sourceSmartTable.getElements();
		} catch (error) {
			this.toastrService.danger(error, this.getTranslation('TOASTR.TITLE.ERROR'));
		}
	}

	/**
	 * Load smart tables settings configurations
	 */
	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.CANDIDATE'),
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.FULL_NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: PictureNameTagsComponent,
					componentInitFunction: (instance: PictureNameTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'user.name', search: value });
					}
				},
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email',
					class: 'email-column',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'user.email', search: value });
					}
				},
				source: {
					title: this.getTranslation('SM_TABLE.SOURCE'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					isFilterable: false,
					renderComponent: CandidateSourceComponent,
					componentInitFunction: (instance: CandidateSourceComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				appliedDate: {
					title: this.getTranslation('SM_TABLE.APPLIED_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				hiredDate: {
					title: this.getTranslation('SM_TABLE.HIRED_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				rejectDate: {
					title: this.getTranslation('SM_TABLE.REJECTED_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				tags: {
					title: this.getTranslation('SM_TABLE.TAGS'),
					type: 'custom',
					width: '5%',
					isFilterable: false,
					renderComponent: TagsOnlyComponent,
					componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '5%',
					isFilterable: false,
					renderComponent: CandidateStatusComponent,
					componentInitFunction: (instance: CandidateStatusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	/**
	 *
	 * @param checked
	 */
	changeIncludeArchived(checked: boolean) {
		this.includeArchived = checked;
		this.candidates$.next(true);
	}

	/**
	 * Archive a candidate with confirmation.
	 * @param selectedItem - The candidate to be archive.
	 */
	async archive(selectedItem?: ICandidateViewModel) {
		if (selectedItem) {
			this.selectCandidate({ isSelected: true, data: selectedItem });
		}

		// Open a confirmation dialog for the hiring action.
		const dialogRef = this.dialogService.open(ArchiveConfirmationComponent, {
			context: {
				recordType:
					this.selectedCandidate.fullName + ' ' + this.getTranslation('FORM.ARCHIVE_CONFIRMATION.CANDIDATE')
			}
		});

		dialogRef.onClose
			.pipe(
				untilDestroyed(this) // Ensures the observable is properly managed to prevent memory leaks.
			)
			.subscribe(async (result) => {
				if (!result) return; // If the dialog is closed without confirmation, exit the function.

				try {
					const { id: organizationId, tenantId } = this.organization;
					const { id, fullName } = this.selectedCandidate;

					await this.candidatesService.setCandidateAsArchived(id, {
						organizationId,
						tenantId
					}); // Set the candidate as Archived.

					this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_ARCHIVED', { name: fullName });
				} catch (error) {
					// Handle any errors that occur during the process.

					this.errorHandler.handleError(error);
				} finally {
					// Refresh the candidate list and update the UI.

					this._refresh$.next(true);
					this.candidates$.next(true);
				}
			});
	}

	/**
	 * Rejects a candidate with confirmation.
	 * @param selectedItem - The candidate to be rejected.
	 */
	async reject(selectedItem?: ICandidateViewModel) {
		if (selectedItem) {
			this.selectCandidate({ isSelected: true, data: selectedItem });
		}

		// Open a confirmation dialog for the hiring action.
		const dialogRef = this.dialogService.open(CandidateActionConfirmationComponent, {
			context: {
				recordType: this.selectedCandidate.fullName,
				isReject: true
			}
		});

		// Handle the dialog close event.
		dialogRef.onClose
			.pipe(
				untilDestroyed(this) // Ensures the observable is properly managed to prevent memory leaks.
			)
			.subscribe(async (result) => {
				if (!result) return; // If the dialog is closed without confirmation, exit the function.

				try {
					const { id, fullName } = this.selectedCandidate;
					await this.candidatesService.setCandidateAsRejected(id); // Set the candidate status to 'rejected'.

					// Show a success message using the toastr service.
					this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_REJECTED', { name: fullName });
				} catch (error) {
					// Handle any errors that occur during the process.
					this.errorHandler.handleError(error);
				} finally {
					// Refresh the candidate list and update the UI.
					this._refresh$.next(true);
					this.candidates$.next(true);
				}
			});
	}

	/**
	 * Initiates the hiring process for a selected candidate.
	 * Opens a confirmation dialog, and if confirmed, sets the candidate status to 'hired'.
	 *
	 * @param selectedItem - Optional candidate data to be selected and processed.
	 */
	async hire(selectedItem?: ICandidateViewModel): Promise<void> {
		// If a specific candidate is passed, select it.
		if (selectedItem) {
			this.selectCandidate({ isSelected: true, data: selectedItem });
		}

		// Open a confirmation dialog for the hiring action.
		const dialogRef = this.dialogService.open(CandidateActionConfirmationComponent, {
			context: {
				recordType: this.selectedCandidate.fullName,
				isReject: false
			}
		});

		// Handle the dialog close event.
		dialogRef.onClose
			.pipe(
				untilDestroyed(this) // Ensures the observable is properly managed to prevent memory leaks.
			)
			.subscribe(async (result) => {
				if (!result) return; // If the dialog is closed without confirmation, exit the function.

				try {
					const { id, fullName } = this.selectedCandidate;
					await this.candidatesService.setCandidateAsHired(id); // Set the candidate status to 'hired'.

					// Show a success message using the toastr service.
					this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_HIRED', { name: fullName });
				} catch (error) {
					// Handle any errors that occur during the process.
					this.errorHandler.handleError(error);
				} finally {
					// Refresh the candidate list and update the UI.
					this._refresh$.next(true);
					this.candidates$.next(true);
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
	private _clearItem() {
		this.selectCandidate({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
