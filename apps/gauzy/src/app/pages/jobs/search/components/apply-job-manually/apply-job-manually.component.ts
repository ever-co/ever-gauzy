import { AfterViewInit, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IOrganization } from '@gauzy/contracts';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular';
import { Store } from './../../../../../@core/services';
import { FormHelpers } from './../../../../../@shared/forms';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { ckEditorConfig } from './../../../../../@shared/ckeditor.config';
import { NbDialogRef } from '@nebular/theme';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-apply-job-manually',
	templateUrl: './apply-job-manually.component.html',
	styleUrls: ['./apply-job-manually.component.scss']
})
export class ApplyJobManuallyComponent extends TranslationBaseComponent
	implements AfterViewInit, OnInit {

	FormHelpers: typeof FormHelpers = FormHelpers;
	public ckConfig: CKEditor4.Config = ckEditorConfig;
	public organization: IOrganization;

	/*
	* Apply Bob Manually Form
	*/
	public form: FormGroup = ApplyJobManuallyComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			proposal: [], // Cover Letter
			details: [], // Proposal details
			attachments: [],
			rate: [] // Hourly Rate
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly dialogRef: NbDialogRef<ApplyJobManuallyComponent>,
		private readonly store: Store,
		readonly translateService: TranslateService,
	) {
		super(translateService);
	}

	ngOnInit(): void { }

	ngAfterViewInit(): void { }

	/**
	 *
	 */
	onSubmit() {
		console.log(this.form);
	}

	/**
	 *
	 */
	close() {
		this.dialogRef.close();
	}
}
