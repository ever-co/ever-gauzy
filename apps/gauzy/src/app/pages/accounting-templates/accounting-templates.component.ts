import {
	AfterViewInit,
	Component,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
	AccountingTemplateTypeEnum,
	IOrganization,
	LanguagesEnum
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { AccountingTemplateService } from '../../@core/services/accounting-template.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbThemeService } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { filter } from 'rxjs/operators';
@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './accounting-templates.component.html',
	styleUrls: ['./accounting-templates.component.scss']
})
export class AccountingTemplatesComponent
	implements OnInit, AfterViewInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	previewTemplate: SafeHtml;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateTypes: string[] = Object.values(AccountingTemplateTypeEnum);
	organizationName: string;

	@ViewChild('templateEditor') templateEditor;
	selectedLanguage: LanguagesEnum;
	organization: IOrganization;

	constructor(
		private accountingTemplateService: AccountingTemplateService,
		private fb: FormBuilder,
		private store: Store,
		private sanitizer: DomSanitizer,
		private themeService: NbThemeService
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (organization) => {
				if (organization) {
					this.organizationName = organization.name;
					this.organization = organization;
					await this.getTemplate();
				}
			});

		this._initializeForm();

	}

	ngAfterViewInit() {
		this.themeService
			.getJsTheme()
			.pipe(untilDestroyed(this))
			.subscribe(
				({
					name
				}: {
					name: 'dark' | 'cosmic' | 'corporate' | 'default';
				}) => {
					switch (name) {
						case 'dark':
						case 'cosmic':
							this.templateEditor.setTheme('tomorrow_night');
							break;
						default:
							this.templateEditor.setTheme('sqlserver');
							break;
					}
				}
			);

		const editorOptions = {
			enableBasicAutocompletion: true,
			enableLiveAutocompletion: true,
			printMargin: false,
			showLineNumbers: true,
			tabSize: 2
		};

		this.templateEditor.getEditor().setOptions(editorOptions);
	}

	async getTemplate() {
		const result = this.form
			? await this.accountingTemplateService.getTemplate({
				languageCode: this.form.get('languageCode').value,
				templateType: this.form.get('templateType').value,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId
			})
			: await this.accountingTemplateService.getTemplate({
				languageCode: LanguagesEnum.ENGLISH,
				templateType: AccountingTemplateTypeEnum.INVOICE,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId
			});
		this.templateEditor.value = result.mjml;

		const html = await this.accountingTemplateService.generateTemplatePreview(
			{
				organization: this.organizationName,
				data: result.mjml,
			}

		);

		this.previewTemplate = this.sanitizer.bypassSecurityTrustHtml(
			html.html
		);
	}

	async onTemplateChange(code: string) {
		this.form.get('mjml').setValue(code);
		const html = await this.accountingTemplateService.generateTemplatePreview(
			{
				organization: this.organizationName,
				data: code,
			}
		);
		this.previewTemplate = this.sanitizer.bypassSecurityTrustHtml(
			html.html
		);
	}

	async onSave() {
		await this.accountingTemplateService.saveTemplate({
			...this.form.value,
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId,
		});
	}

	private _initializeForm() {
		this.form = this.fb.group({
			templateType: [AccountingTemplateTypeEnum.INVOICE],
			languageCode: [LanguagesEnum.ENGLISH],
			mjml: ['']
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
