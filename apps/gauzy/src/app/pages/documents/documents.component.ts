import { Component, OnInit, ViewChild, OnDestroy, TemplateRef } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, FormArray, Validators } from '@angular/forms';
import { IOrganizationDocument, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DeleteConfirmationComponent } from './../../@shared/user/forms';
import { UploadDocumentComponent } from './upload-document/upload-document.component';
import { ComponentEnum } from '@gauzy/ui-sdk/common';
import { ErrorHandlingService, OrganizationDocumentsService, ToastrService } from '@gauzy/ui-sdk/core';
import {
	DocumentDateTableComponent,
	DocumentUrlTableComponent,
	IPaginationBase,
	PaginationFilterBaseComponent
} from '@gauzy/ui-sdk/shared';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs/internal/Subject';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-documents',
	templateUrl: './documents.component.html',
	styleUrls: ['documents.component.scss']
})
export class DocumentsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	@ViewChild('uploadDoc') uploadDoc: UploadDocumentComponent;
	@ViewChild('addEditTemplate') addEditTemplate: TemplateRef<any>;

	addEditDialogRef: NbDialogRef<any>;
	formDocument: UntypedFormGroup;
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
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Organization Document Mutation Form
	 */
	public form: UntypedFormGroup = DocumentsComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group({
			documents: fb.array([])
		});
		const documentForm = form.controls.documents as FormArray;
		documentForm.push(
			fb.group({
				name: [null, Validators.required],
				documentUrl: [null, Validators.required],
				documentId: [null]
			})
		);
		return form;
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly organizationDocumentsService: OrganizationDocumentsService,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService
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
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
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
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.documentList = [])),
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
				tap((componentLayout: ComponentLayoutStyleEnum) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				tap(() => (this.documentList = [])),
				tap(() => this.subject$.next(true)),
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

	private get _isGridLayout(): boolean {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
	}

	submitForm() {
		const documentForm = this.documents() as FormArray;
		const formValue = { ...documentForm.value[0] };
		this.formDocument = this.uploadDoc.form;
		formValue.documentUrl = this.formDocument.get('docUrl').value;
		formValue.documentId = this.formDocument.get('documentId').value;

		if (this.documentId !== null) {
			formValue.documentUrl = formValue.documentUrl === '' ? this.documentUrl : formValue.documentUrl;

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
			.pipe(first(), untilDestroyed(this))
			.subscribe(
				() => {
					this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.CREATED', {
						name: formValue.name
					});
					this.addEditDialogRef.close();
					this.cancel();
					this._refresh$.next(true);
					this.subject$.next(true);
				},
				() => this.toastrService.error('NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_CREATE')
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
					this.loading = false;
					this.smartTableSource.setPaging(activePage, itemsPerPage, false);
					this.smartTableSource.load(data.items);
					if (this._isGridLayout) {
						this._loadGridLayoutData();
					} else this.documentList = data.items;
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
				},
				error: () =>
					this._errorHandlingService.handleError(
						this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_LOAD')
					)
			});
	}

	private async _loadGridLayoutData() {
		this.documentList.push(...(await this.smartTableSource.getElements()));
	}

	private _updateDocument(formValue: IOrganizationDocument) {
		this.organizationDocumentsService
			.update(this.documentId, { ...formValue })
			.pipe(untilDestroyed(this), first())
			.subscribe({
				next: () => {
					this.toastrService.success(
						this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.UPDATED', {
							name: formValue.name
						})
					);
					this.addEditDialogRef.close();
					this.cancel();
					this._refresh$.next(true);
					this.subject$.next(true);
				},
				error: () => this.toastrService.error('NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_UPDATED')
			});
	}

	editDocument(document: IOrganizationDocument) {
		this.form.controls.documents.patchValue([document]);
		this.documentId = document.id;
		this.documentUrl = document.documentUrl;
	}

	removeDocument(document: IOrganizationDocument) {
		if (!document) {
			document = this.selectedDocument;
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.SELECTED_DOC'
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
									this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.DELETED', {
										name: document.name
									})
								);
								this._refresh$.next(true);
								this.subject$.next(true);
							},
							error: () =>
								this._errorHandlingService.handleError(
									this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATION_DOCS.ERR_DELETED')
								)
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
