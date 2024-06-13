import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormBuilder, Validators, UntypedFormGroup, FormArray } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LocalDataSource } from 'angular2-smart-table';
import { ICandidateDocument, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { ComponentEnum, Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { CandidateDocumentsService, CandidateStore, ToastrService } from '@gauzy/ui-core/core';
import {
	CandidateCvComponent,
	DocumentDateTableComponent,
	DocumentUrlTableComponent,
	PaginationFilterBaseComponent
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-candidate-documents',
	templateUrl: './edit-candidate-documents.component.html',
	styleUrls: ['./edit-candidate-documents.component.scss']
})
export class EditCandidateDocumentsComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy
{
	@ViewChild('candidateCv')
	candidateCv: CandidateCvComponent;

	documentId = null;
	showAddCard: boolean;
	documentList: ICandidateDocument[] = [];
	candidateId: string;
	formCv: UntypedFormGroup;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	documentUrl = '';
	selectedOrganization: IOrganization;

	/*
	 * Candidate Document Mutation Form
	 */
	public form: UntypedFormGroup = EditCandidateDocumentsComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group({
			documents: fb.array([])
		});
		const documentForm = form.controls.documents as FormArray;
		documentForm.push(
			fb.group({
				name: ['', Validators.required],
				documentUrl: ['', Validators.required]
			})
		);
		return form;
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly candidateDocumentsService: CandidateDocumentsService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly candidateStore: CandidateStore,
		private readonly store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$.pipe(untilDestroyed(this)).subscribe((candidate) => {
			if (candidate) {
				this.selectedOrganization = this.store.selectedOrganization;
				this.candidateId = candidate.id;
				this.loadDocuments();
				this.loadSmartTable();
			}
		});
	}

	ngAfterViewInit() {
		this._applyTranslationOnSmartTable();
	}

	setView() {
		this.viewComponentName = ComponentEnum.DOCUMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string'
				},
				documentUrl: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.DOCUMENT_URL'),
					type: 'custom',
					renderComponent: DocumentUrlTableComponent
				},
				updated: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.UPDATED'),
					type: 'custom',
					renderComponent: DocumentDateTableComponent
				}
			}
		};
	}

	private async loadDocuments() {
		if (!this.selectedOrganization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;

		const { items = [] } = await this.candidateDocumentsService.getAll({
			candidateId: this.candidateId,
			organizationId,
			tenantId
		});

		this.documentList = items;
		this.smartTableSource.load(items);
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
	}

	showCard() {
		this.showAddCard = !this.showAddCard;
		this.documents.reset();
	}

	editDocument(doc: ICandidateDocument) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.documents.patchValue([doc]);
		this.documentId = doc.id;
		this.documentUrl = doc.documentUrl;
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
		this.documents.value.length = 0;
		this.documentUrl = '';
	}

	async submitForm() {
		const documentForm = this.documents;
		const formValue = { ...documentForm.value[0] };
		this.formCv = this.candidateCv.form;
		formValue.documentUrl = this.formCv.get('cvUrl').value;
		if (this.documentId !== null) {
			//editing existing document
			formValue.documentUrl = formValue.documentUrl === '' ? this.documentUrl : formValue.documentUrl;
			if (formValue.name !== '') {
				this.updateDocument(formValue);
			} else {
				this.toastrInvalid();
			}
		} else {
			//creating document
			if (formValue.documentUrl !== '' && formValue.name !== '') {
				this.createDocument(formValue);
			} else {
				this.toastrInvalid();
			}
		}
	}

	async updateDocument(formValue: ICandidateDocument) {
		try {
			if (!this.selectedOrganization) {
				return;
			}

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.selectedOrganization;

			await this.candidateDocumentsService.update(this.documentId, {
				...formValue,
				organizationId,
				tenantId
			});
			this.loadDocuments();
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_DOCUMENT_UPDATED', {
				name: formValue.name
			});
			this.showAddCard = !this.showAddCard;
			this.form.controls.documents.reset();
		} catch (error) {
			this.toastrError(error);
		}
		this.documentId = null;
		this.documentUrl = '';
	}

	async createDocument(formValue: ICandidateDocument) {
		try {
			if (!this.selectedOrganization) {
				return;
			}

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.selectedOrganization;

			await this.candidateDocumentsService.create({
				...formValue,
				candidateId: this.candidateId,
				organizationId,
				tenantId
			});
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_DOCUMENT_CREATED', {
				name: formValue.name
			});
			this.loadDocuments();
			this.showAddCard = !this.showAddCard;
			this.documents.reset();
		} catch (error) {
			this.toastrError(error);
		}
	}

	async removeDocument(document) {
		try {
			await this.candidateDocumentsService.delete(document.id);
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_DOCUMENT_DELETED', {
				name: document.name
			});
			this.loadDocuments();
		} catch (error) {
			this.toastrError(error);
		}
	}

	private toastrError(error) {
		this.toastrService.danger('NOTES.CANDIDATE.EXPERIENCE.ERROR', 'TOASTR.TITLE.ERROR', {
			error: error.error ? error.error.message : error.message
		});
	}

	private toastrInvalid() {
		this.toastrService.danger(
			'NOTES.CANDIDATE.INVALID_FORM',
			'TOASTR.TITLE.ERROR',
			'TOASTR.MESSAGE.CANDIDATE_DOCUMENT_REQUIRED'
		);
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}

	/*
	 * Getter for candidate documents form controls array
	 */
	get documents(): FormArray {
		return this.form.get('documents') as FormArray;
	}
}
