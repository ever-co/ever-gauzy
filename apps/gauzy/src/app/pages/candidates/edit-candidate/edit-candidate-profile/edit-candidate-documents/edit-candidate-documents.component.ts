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
import { ICandidateDocument } from '@gauzy/models';

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
	documentUrl = '';
	constructor(
		private readonly fb: FormBuilder,
		private readonly candidateDocumentsService: CandidateDocumentsService,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore
	) {
		super(translateService);
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadDocuments();
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
	private async loadDocuments() {
		const res = await this.candidateDocumentsService.getAll({
			candidateId: this.candidateId
		});
		if (res) {
			this.documentList = res.items;
		}
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

	cancel() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.documents.value.length = 0;
		this.documentUrl = '';
	}

	async submitForm() {
		const documentForm = this.form.controls.documents as FormArray;
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
			await this.candidateDocumentsService.update(this.documentId, {
				...formValue
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
			await this.candidateDocumentsService.create({
				...formValue,
				candidateId: this.candidateId
			});
			this.toastrSuccess('CREATED');
			this.loadDocuments();
			this.showAddCard = !this.showAddCard;
			this.form.controls.documents.reset();
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
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
