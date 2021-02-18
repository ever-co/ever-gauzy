import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
	AccountingTemplateNameEnum,
	IOrganization,
	LanguagesEnum
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { AccountingTemplateService } from '../../@core/services/accounting-template.service';

@Component({
	templateUrl: './accounting-templates.component.html',
	styleUrls: ['./accounting-templates.component.scss']
})
export class AccountingTemplatesComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	previewTemplate: SafeHtml;
	organization: IOrganization;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateNames: string[] = Object.values(AccountingTemplateNameEnum);

	@ViewChild('templateEditor') templateEditor;

	constructor(
		private accountingTemplateService: AccountingTemplateService,
		private fb: FormBuilder,
		private sanitizer: DomSanitizer
	) {}

	ngOnInit() {
		this.getTemplate();
		this._initializeForm();
	}

	async getTemplate() {
		const result = this.form
			? await this.accountingTemplateService.getTemplate({
					languageCode: this.form.get('languageCode').value,
					name: this.form.get('name').value
			  })
			: await this.accountingTemplateService.getTemplate({
					languageCode: LanguagesEnum.ENGLISH,
					name: AccountingTemplateNameEnum.INVOICE
			  });
		this.templateEditor.value = result.mjml;

		const html = await this.accountingTemplateService.generateTemplatePreview(
			result.mjml
		);
		this.previewTemplate = this.sanitizer.bypassSecurityTrustHtml(
			html.html
		);
	}

	async getPreview() {}

	private _initializeForm() {
		this.form = this.fb.group({
			name: [AccountingTemplateNameEnum.INVOICE],
			languageCode: [LanguagesEnum.ENGLISH],
			subject: [''],
			mjml: ['']
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
