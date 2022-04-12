import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import {
	IOrganizationDocument,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { filter, first, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DeleteConfirmationComponent } from './../../@shared/user/forms';
import { UploadDocumentComponent } from './upload-document/upload-document.component';
import { ComponentEnum } from '../../@core/constants';
import { TranslationBaseComponent } from '../../@shared/language-base';
import { DocumentDateTableComponent, DocumentUrlTableComponent } from '../../@shared/table-components';
import { OrganizationDocumentsService, Store, ToastrService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-documents',
	templateUrl: './documents.component.html'
})
export class DocumentsComponent extends TranslationBaseComponent 
	implements OnInit, OnDestroy {

	@ViewChild('uploadDoc')
	uploadDoc: UploadDocumentComponent;

	formDocument: FormGroup;
	documentUrl = '';
	documentId = null;
	documentList: IOrganizationDocument[] = [];
	showAddCard = false;
	loading = false;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	organization: IOrganization;

	/*
	* Organization Document Mutation Form
	*/
	public form: FormGroup = DocumentsComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
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
		private readonly fb: FormBuilder,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly organizationDocumentsService: OrganizationDocumentsService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this.loadSmartTableSetting();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._loadDocuments()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	documents(): FormArray {
		return this.form.get('documents') as FormArray;
	}

	setView() {
		this.viewComponentName = ComponentEnum.DOCUMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout: ComponentLayoutStyleEnum) => this.dataLayoutStyle = componentLayout),
				untilDestroyed(this)
			)
			.subscribe();
	}
	
	loadSmartTableSetting() {
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
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.organizationDocumentsService
			.create({
				...formValue,
				organizationId,
				tenantId
			})
			.pipe(
				first(),
				untilDestroyed(this)
			)
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
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.loading = true;
		this.organizationDocumentsService
			.getAll({
				organizationId,
				tenantId
			})
			.pipe(
				first(),
				untilDestroyed(this)
			)
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

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadSmartTableSetting()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
