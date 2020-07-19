import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { UploadDocumentComponent } from '../upload-document/upload-document.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { OrganizationDocument } from '@gauzy/models';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { OrganizationDocumentsService } from 'apps/gauzy/src/app/@core/services/organization-documents.service';

@Component({
	selector: 'ga-edit-organization-documents',
	templateUrl: './edit-organization-documents.html'
})
export class EditOrganizationDocuments implements OnInit, OnDestroy {
	@ViewChild('uploadDoc')
	uploadDoc: UploadDocumentComponent;

	loading = false;
	organizationId: string;
	form: FormGroup;
	formDocument: FormGroup;
	documentUrl = '';
	documentId = null;
	documentList: OrganizationDocument[];

	constructor(
		private readonly fb: FormBuilder,
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
		formValue.documentUrl = this.formDocument.get('uploadDoc').value;

		if (formValue.documentUrl !== '' && formValue.name !== '') {
			this._createDocument(formValue);
		} else {
			this.toastrService.error('Unable to create document');
		}
	}

	private _createDocument(formValue: OrganizationDocument) {
		this.organizationDocumentsService.create({
			...formValue,
			organizationId: this.organizationId
		});

		this.toastrService.success('Document successfully created');
	}

	editDocument(index: number, id: string) {
		this.form.controls.documents.patchValue([this.documentList[index]]);
		this.documentId = id;
		this.documentUrl = this.documentList[index].documentUrl;
	}

	removeDocument(id: string) {
		this.organizationDocumentsService.delete(id);
	}

	cancel() {
		this.form.controls.documents.value.length = 0;
		this.documentUrl = '';
	}

	ngOnDestroy() {}
}
