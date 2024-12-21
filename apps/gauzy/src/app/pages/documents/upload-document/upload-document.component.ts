import { Component, OnInit, Input } from '@angular/core';
import { Validators, UntypedFormBuilder, UntypedFormGroup, AbstractControl } from '@angular/forms';
import { IImageAsset } from '@gauzy/contracts';

@Component({
    selector: 'ga-upload-doc',
    templateUrl: './upload-document.component.html',
    standalone: false
})
export class UploadDocumentComponent implements OnInit {

	@Input() documentUrl: string;
	@Input() documentId: string;
	@Input() isDocument: boolean = false;

	public form: UntypedFormGroup = UploadDocumentComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			docUrl: [
				null,
				Validators.compose([
					Validators.pattern(
						new RegExp(
							`(http)?s?:?(\/\/[^"']*\.(?:doc|docx|pdf|))`,
							'g'
						)
					)
				])
			],
			documentId: [],
		});
	}

	get docUrl(): AbstractControl {
		return this.form.get('docUrl');
	}

	get docId(): AbstractControl {
		return this.form.get('documentId');
	}

	constructor(
		private readonly fb: UntypedFormBuilder
	) { }

	ngOnInit(): void { }

	/**
	 * Upload document asset
	 *
	 * @param document
	 */
	uploadedDocumentAsset(document: IImageAsset) {
		try {
			if (document) {
				this.docId.setValue(document.id);
				this.docUrl.setValue(document.fullUrl);
				this.form.updateValueAndValidity();
			}
		} catch (error) {
			console.log('Error while uploading documents by asset');
		}
	}

	/**
	 * Upload document asset via third party document
	 *
	 * @param documentUrl
	 */
	uploadedDocumentUrl(documentUrl: string) {
		try {
			if (documentUrl) {
				this.docUrl.setValue(documentUrl);
				this.docUrl.updateValueAndValidity();
			}
		} catch (error) {
			console.log('Error while uploading documents by third party URL');
		}
	}
}
