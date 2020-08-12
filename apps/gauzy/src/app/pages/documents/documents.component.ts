import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { OrganizationDocument, ComponentLayoutStyleEnum } from '@gauzy/models';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { OrganizationDocumentsService } from 'apps/gauzy/src/app/@core/services/organization-documents.service';
import { first, takeUntil } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UploadDocumentComponent } from './upload-document/upload-document.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';

@Component({
	selector: 'ga-documents',
	templateUrl: './documents.component.html'
})
export class DocumentsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('uploadDoc')
	uploadDoc: UploadDocumentComponent;
	private _ngDestroy$ = new Subject<void>();
	organizationId: string;
	form: FormGroup;
	formDocument: FormGroup;
	documentUrl = '';
	documentId = null;
	documentList: OrganizationDocument[];
	showAddCard = false;
	loading = false;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	constructor(
		private readonly fb: FormBuilder,
		private dialogService: NbDialogService,
		private store: Store,
		readonly translateService: TranslateService,
		private organizationDocumentsService: OrganizationDocumentsService,
		private toastrService: ToastrService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.organizationId = org.id;
					this._initializeForm();
					this._loadDocuments();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();
				}
			});
	}

	private _initializeForm() {
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
					type: 'string'
				},
				updated: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.UPDATED'),
					type: 'string'
				}
			}
		};
	}

	submitForm() {
		const documentForm = this.form.controls.documents as FormArray;
		const formValue = { ...documentForm.value[0] };
		this.formDocument = this.uploadDoc.form;
		formValue.documentUrl = this.formDocument.get('docUrl').value;

		if (this.documentId !== null) {
			formValue.documentUrl =
				formValue.documentUrl === ''
					? this.documentUrl
					: formValue.documentUrl;

			if (formValue.name !== '') {
				this._updateDocument(formValue);
			} else {
				this.toastrService.error('TOASTR.MESSAGE.ERRORS');
			}
		} else {
			if (formValue.documentUrl !== '' && formValue.name !== '') {
				this._createDocument(formValue);
			} else {
				this.toastrService.error('TOASTR.MESSAGE.ERRORS');
			}
		}
	}

	private _createDocument(formValue: OrganizationDocument) {
		this.organizationDocumentsService
			.create({
				...formValue,
				organizationId: this.organizationId
			})
			.pipe(first())
			.subscribe(
				() => {
					this.toastrService.success(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.CREATED'
					);
					this.cancel();
					this._loadDocuments();
				},
				() =>
					this.toastrService.error(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_CREATE'
					)
			);
	}

	private _loadDocuments() {
		this.loading = true;
		const result = [];
		this.organizationDocumentsService
			.getAll({ organizationId: this.organizationId })
			.pipe(first())
			.subscribe(
				(data) => {
					this.documentList = data.items;
					for (const doc of data.items) {
						result.push({
							name: doc.name,
							documentUrl:
								doc.documentUrl.slice(0, 25) +
								'...' +
								doc.documentUrl.slice(-10, -1),
							updated:
								new Date(doc.updatedAt).toDateString() +
								', ' +
								new Date(doc.updatedAt).toLocaleTimeString()
						});
					}
					this.smartTableSource.load(result);
					this.loading = false;
				},
				() =>
					this.toastrService.error(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_LOAD'
					)
			);
	}

	private _updateDocument(formValue: OrganizationDocument) {
		this.organizationDocumentsService
			.update(this.documentId, { ...formValue })
			.pipe(first())
			.subscribe(
				() => {
					this.toastrService.success(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.UPDATED'
					);
					this.cancel();
					this._loadDocuments();
				},
				() =>
					this.toastrService.error(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_UPDATED'
					)
			);
	}

	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.documents.reset();
	}

	editDocument(document: OrganizationDocument) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.documents.patchValue([document]);
		this.documentId = document.id;
		this.documentUrl = document.documentUrl;
	}

	removeDocument(id: string) {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType:
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.SELECTED_DOC'
				}
			})
			.onClose.pipe(first())
			.subscribe((res) => {
				if (res) {
					this.organizationDocumentsService
						.delete(id)
						.pipe(first())
						.subscribe(
							() => {
								this.toastrService.success(
									'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.DELETED'
								);
								this._loadDocuments();
							},
							() =>
								'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_DELETED'
						);
				}
			});
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
		this.form.reset();
		this.documentUrl = null;
	}
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
