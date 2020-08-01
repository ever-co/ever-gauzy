import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { OrganizationDocument } from '@gauzy/models';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { OrganizationDocumentsService } from 'apps/gauzy/src/app/@core/services/organization-documents.service';
import { first } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UploadDocumentComponent } from './upload-document/upload-document.component';

@Component({
	selector: 'ga-documents',
	templateUrl: './documents.component.html'
})
export class DocumentsComponent implements OnInit, OnDestroy {
	@ViewChild('uploadDoc')
	uploadDoc: UploadDocumentComponent;

	organizationId: string;
	form: FormGroup;
	formDocument: FormGroup;
	documentUrl = '';
	documentId = null;
	documentList: OrganizationDocument[];
	showAddCard = false;
	loading = false;

	constructor(
		private readonly fb: FormBuilder,
		private dialogService: NbDialogService,
		private store: Store,
		private organizationDocumentsService: OrganizationDocumentsService,
		private toastrService: ToastrService
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				this.organizationId = org.id;

				this._initializeForm();
				this._loadDocuments();
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
					this.showAddCard = !this.showAddCard;
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
			.getAll({ organizationId: this.organizationId })
			.pipe(first())
			.subscribe(
				(res) => {
					this.documentList = res.items;
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
					this.showAddCard = !this.showAddCard;
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

	editDocument(index: number, id: string) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.documents.patchValue([this.documentList[index]]);
		this.documentId = id;
		this.documentUrl = this.documentList[index].documentUrl;
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
	}

	ngOnDestroy() {}
}
