import { Component, OnInit, ViewChild, OnDestroy, TemplateRef } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import {
	IOrganizationDocument,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DeleteConfirmationComponent } from './../../@shared/user/forms';
import { UploadDocumentComponent } from './upload-document/upload-document.component';
import { ComponentEnum } from '../../@core/constants';
import { DocumentDateTableComponent, DocumentUrlTableComponent } from '../../@shared/table-components';
import { OrganizationDocumentsService, Store, ToastrService } from '../../@core/services';
import { ActivatedRoute } from '@angular/router';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-documents',
	templateUrl: './documents.component.html',
	styleUrls: ['documents.component.scss']
})
export class DocumentsComponent extends PaginationFilterBaseComponent 
	implements OnInit, OnDestroy {

	@ViewChild('uploadDoc')
	uploadDoc: UploadDocumentComponent;
	@ViewChild('addEditTemplate') 
	addEditTemplate: TemplateRef<any>;
	addEditDialogRef: NbDialogRef<any>;
	formDocument: FormGroup;
	documentUrl = '';
	documentId = null;
	documentList: IOrganizationDocument[] = [];
	loading = false;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	viewComponentName: ComponentEnum;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	organization: IOrganization;
	disabled: boolean = true;
	selectedDocument: IOrganizationDocument;
	selected = {
		document: null,
		state: false
	};
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
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.subject$
			.pipe(
				tap(() => this._loadDocuments()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
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
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.openDialog(this.addEditTemplate, false)),
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
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			pager: {
				perPage: pagination ? pagination : 10
			},
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
					this.addEditDialogRef.close()
					this.cancel();
					this.subject$.next(true);
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
		const { activePage, itemsPerPage } = this.getPagination();

		this.loading = true;
		this.organizationDocumentsService
			.getAll({
				organizationId,
				tenantId
			})
			.pipe(first(), untilDestroyed(this))
			.subscribe({
				next: (data) => {
					this.documentList = data.items;
					this.loading = false;
					this.smartTableSource.setPaging(
						activePage,
						itemsPerPage,
						false
					);
					this.smartTableSource.load(data.items);
					if (
						this.componentLayoutStyleEnum.CARDS_GRID ===
						this.dataLayoutStyle
					)
						this._loadGridLayoutData();
				},
				error: () =>
					this.toastrService.error(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_LOAD'
					)
			});
	}

	private async _loadGridLayoutData() {
		this.documentList = await this.smartTableSource.getElements();
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
	}

	private _updateDocument(formValue: IOrganizationDocument) {
		this.organizationDocumentsService
			.update(this.documentId, { ...formValue })
			.pipe(untilDestroyed(this), first())
			.subscribe({
				next: () => {
					this.toastrService.success(
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.UPDATED',
							{
								name: formValue.name
							}
						)
					);
					this.addEditDialogRef.close();
					this.cancel();
					this.subject$.next(true);
				},
				error: () =>
					this.toastrService.error(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_UPDATED'
					)
			});
	}

	editDocument(document: IOrganizationDocument) {
		this.form.controls.documents.patchValue([document]);
		this.documentId = document.id;
		this.documentUrl = document.documentUrl;
	}

	removeDocument(document: IOrganizationDocument) {
		if(!document){
			document = this.selectedDocument
		}		
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
						.subscribe({
							next: () => {
								this.toastrService.success(
									this.getTranslation(
										'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.DELETED',
										{
											name: document.name
										}
									)
								);
								this.subject$.next(true);
							},
							error: () =>
								'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_DELETED'
						});
				}
			});
	}

	cancel() {
		this.form.reset();
		this.documentUrl = null;
		this.documentId = null;
		this.selected = {
			document: null,
			state: false
		};
		this.disabled = true;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadSmartTableSetting()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	edit(document: IOrganizationDocument) {
		this.selectedDocument = document;
		this.form.controls.documents.patchValue([document]);
		this.documentId = document.id;
		this.documentUrl = document.documentUrl;
	}

	openDialog(template: TemplateRef<any>, isEditTemplate: boolean) {
		try {
			isEditTemplate ? this.edit(this.selectedDocument) : this.cancel();
			this.addEditDialogRef = this.dialogService.open(template);
		} catch (error) {
			console.log('An error occurred on open dialog');
		}
	}
	
	selectDocument(position: any) {
		if (position.data) position = position.data;
		const res =
			this.selected.document && position.id === this.selected.document.id
				? { state: !this.selected.state }
				: { state: true };
		this.disabled = !res.state;
		this.selected.state = res.state;
		this.selected.document = position;
		this.selectedDocument = this.selected.document;
	}

	ngOnDestroy(): void {}
}
