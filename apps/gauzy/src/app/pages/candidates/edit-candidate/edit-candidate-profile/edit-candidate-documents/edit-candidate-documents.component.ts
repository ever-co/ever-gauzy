import { Component, OnInit } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { ICandidateCv } from 'libs/models/src/lib/candidate-cv.model';
import { FormBuilder, Validators } from '@angular/forms';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { takeUntil } from 'rxjs/operators';
import { CandidateCvService } from 'apps/gauzy/src/app/@core/services/candidate-cv.service';

@Component({
	selector: 'ga-edit-candidate-documents',
	templateUrl: './edit-candidate-documents.component.html'
})
export class EditCandidateDocumentsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	candidateId: string;
	showAddCard: boolean;
	showEditDiv: boolean;

	selectedDoc: ICandidateCv;
	form: any;
	cvUrl: any;
	name: any;
	docs: any[];
	constructor(
		private readonly fb: FormBuilder,
		private readonly candidateCVsService: CandidateCvService,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,

		private errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this.loadDocs();
				}
			});

		this.form = this.fb.group({
			filename: [''],
			cvUrl: [
				'',
				Validators.compose([
					Validators.pattern(
						new RegExp(
							`(http)?s?:?(\/\/[^"']*\.(?:doc|docx|pdf|))`,
							'g'
						)
					)
				])
			]
		});

		this.name = this.form.get('filename');
		this.cvUrl = this.form.get('cvUrl');
	}

	showEditCard(doc: ICandidateCv) {
		this.showEditDiv = true;
		this.selectedDoc = doc;
	}

	cancel() {
		this.showEditDiv = !this.showEditDiv;
		this.selectedDoc = null;
	}

	async removeDoc(id: string, name: string) {
		try {
			await this.candidateCVsService.delete(id);
			this.loadDocs();
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	async editVendor(id: string, name: string) {
		await this.candidateCVsService.update(id, { name });
		this.loadDocs();
		this.toastrService.success('Successfully updated');
		this.showEditDiv = !this.showEditDiv;
	}

	async addCV(name: string) {
		if (name) {
			await this.candidateCVsService.create({
				name,
				candidateId: this.candidateId,
				cvUrl: this.cvUrl.value
			});

			this.showAddCard = !this.showAddCard;
			// this.loadDocs();
		} else {
			// TODO toasrt
		}
	}
	private async loadDocs() {
		if (!this.candidateId) {
			return;
		}

		const res = await this.candidateCVsService.getAll(
			['projects', 'members', 'members.user'],
			{
				candidateId: this.candidateId
			}
		);
		if (res) {
			this.docs = res.items;
		}
	}
}
