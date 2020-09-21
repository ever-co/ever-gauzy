import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { FormBuilder, Validators, FormGroup, FormArray } from '@angular/forms';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { takeUntil } from 'rxjs/operators';
import { CandidateDocumentsService } from 'apps/gauzy/src/app/@core/services/candidate-documents.service';
import { CandidateCvComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-cv/candidate-cv.component';
import {
	ICandidateDocument,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { ComponentEnum } from 'apps/gauzy/src/app/@core/constants/layout.constants';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { LocalDataSource } from 'ng2-smart-table';
import { DocumentUrlTableComponent } from 'apps/gauzy/src/app/@shared/table-components/document-url/document-url.component';
import { DocumentDateTableComponent } from 'apps/gauzy/src/app/@shared/table-components/document-date/document-date.component';

@Component({
	selector: 'ga-edit-candidate-documents',
	templateUrl: './edit-candidate-documents.component.html',
	styleUrls: ['./edit-candidate-documents.component.scss']
})
export class EditCandidateDocumentsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('candidateCv')
	candidateCv: CandidateCvComponent;
	private _ngDestroy$ = new Subject<void>();
	documentId = null;
	showAddCard: boolean;
	documentList: ICandidateDocument[] = [];
	candidateId: string;
	form: FormGroup;
	formCv: FormGroup;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	documentUrl = '';
	selectedOrganization: IOrganization;
	constructor(
		private readonly fb: FormBuilder,
		private readonly candidateDocumentsService: CandidateDocumentsService,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.selectedOrganization = this.store.selectedOrganization;
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadDocuments();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();
				}
			});
	}
	private async _initializeForm() {
		this.form = new FormGroup({
			documents: this.fb.array([])
		});
		const documentForm = this.form.controls.documents as FormArray;
		documentForm.push(
			this.fb.group({
				name: ['', Validators.required],
				documentUrl: ['', Validators.required]
			})
		);
	}
	setView() {
		this.viewComponentName = ComponentEnum.DOCUMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string'
				},
				documentUrl: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.DOCUMENT_URL'
					),
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
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { items = [] } = await this.candidateDocumentsService.getAll({
			candidateId: this.candidateId,
			organizationId,
			tenantId
		});
		this.documentList = items;
		this.smartTableSource.load(items);
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
			formValue.documentUrl =
				formValue.documentUrl === ''
					? this.documentUrl
					: formValue.documentUrl;
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
			const { id: organizationId, tenantId } = this.selectedOrganization;
			await this.candidateDocumentsService.update(this.documentId, {
				...formValue,
				organizationId,
				tenantId
			});
			this.loadDocuments();
			this.toastrSuccess('UPDATED');
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
			const { id: organizationId, tenantId } = this.selectedOrganization;
			await this.candidateDocumentsService.create({
				...formValue,
				candidateId: this.candidateId,
				organizationId,
				tenantId
			});
			this.toastrSuccess('CREATED');
			this.loadDocuments();
			this.showAddCard = !this.showAddCard;
			this.documents.reset();
		} catch (error) {
			this.toastrError(error);
		}
	}

	async removeDocument(id: string) {
		try {
			await this.candidateDocumentsService.delete(id);
			this.toastrSuccess('DELETED');
			this.loadDocuments();
		} catch (error) {
			this.toastrError(error);
		}
	}

	private toastrError(error) {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
				error: error.error ? error.error.message : error.message
			}),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}

	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
	}
	private toastrInvalid() {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.INVALID_FORM'),
			this.getTranslation('TOASTR.MESSAGE.CANDIDATE_DOCUMENT_REQUIRED')
		);
	}
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
	/*
	 * Getter for candidate documents form controls array
	 */
	get documents(): FormArray {
		return this.form.get('documents') as FormArray;
	}
}
