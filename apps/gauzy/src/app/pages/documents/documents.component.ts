import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import {
	IOrganizationDocument,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { OrganizationDocumentsService } from 'apps/gauzy/src/app/@core/services/organization-documents.service';
import { filter, first } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UploadDocumentComponent } from './upload-document/upload-document.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { DocumentUrlTableComponent } from '../../@shared/table-components/document-url/document-url.component';
import { DocumentDateTableComponent } from '../../@shared/table-components/document-date/document-date.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-documents',
	templateUrl: './documents.component.html'
})
export class DocumentsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('uploadDoc')
	uploadDoc: UploadDocumentComponent;
	organizationId: string;
	form: FormGroup;
	formDocument: FormGroup;
	documentUrl = '';
	documentId = null;
	documentList: IOrganizationDocument[];
	showAddCard = false;
	loading = false;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedOrganization: IOrganization;

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
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.selectedOrganization = organization;
					this._loadDocuments();
				}
			});
		this._applyTranslationOnSmartTable();
		this.loadSmartTable();
		this._initializeForm();
	}

	documents(): FormArray {
		return this.form.get('documents') as FormArray;
	}

	private _initializeForm() {
		this.form = new FormGroup({
			documents: this.fb.array([])
		});
		const documentForm = this.documents() as FormArray;
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
			.pipe(untilDestroyed(this))
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

	submitForm() {
		const documentForm = this.documents() as FormArray;
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

	private _createDocument(formValue: IOrganizationDocument) {
		this.organizationDocumentsService
			.create({
				...formValue,
				organizationId: this.selectedOrganization.id,
				tenantId: this.selectedOrganization.tenantId
			})
			.pipe(untilDestroyed(this), first())
			.subscribe(
				() => {
					this.toastrService.success(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.CREATED',
						{
							name: formValue.name
						}
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
		this.organizationDocumentsService
			.getAll({
				organizationId: this.selectedOrganization.id,
				tenantId: this.selectedOrganization.tenantId
			})
			.pipe(untilDestroyed(this), first())
			.subscribe(
				(data) => {
					this.documentList = data.items;
					this.smartTableSource.load(data.items);
					this.loading = false;
				},
				() =>
					this.toastrService.error(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_LOAD'
					)
			);
	}

	private _updateDocument(formValue: IOrganizationDocument) {
		this.organizationDocumentsService
			.update(this.documentId, { ...formValue })
			.pipe(untilDestroyed(this), first())
			.subscribe(
				() => {
					this.toastrService.success(
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.UPDATED',
							{
								name: formValue.name
							}
						)
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
		this.documentId = null;
		this.documentUrl = null;
	}

	editDocument(document: IOrganizationDocument) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.documents.patchValue([document]);
		this.documentId = document.id;
		this.documentUrl = document.documentUrl;
	}

	removeDocument(document: IOrganizationDocument) {
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
						.delete(document.id)
						.pipe(first())
						.subscribe(
							() => {
								this.toastrService.success(
									this.getTranslation(
										'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.DELETED',
										{
											name: document.name
										}
									)
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
		this.documentId = null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	ngOnDestroy(): void {}
}
