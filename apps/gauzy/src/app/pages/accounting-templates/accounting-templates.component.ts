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
import { AccountingTemplateService } from '../../@core/services/accounting-template.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbThemeService } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './accounting-templates.component.html',
	styleUrls: ['./accounting-templates.component.scss']
})
export class AccountingTemplatesComponent
	implements OnInit, AfterViewInit, OnDestroy {

	form: FormGroup;
	previewTemplate: SafeHtml;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateTypes: string[] = Object.values(AccountingTemplateTypeEnum);
	organizationName: string;
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	@ViewChild('templateEditor') templateEditor;

	constructor(
		private accountingTemplateService: AccountingTemplateService,
		private fb: FormBuilder,
		private store: Store,
		private sanitizer: DomSanitizer,
		private themeService: NbThemeService
	) {}

	ngOnInit() {
		this._initializeForm();
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getTemplate()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.preferredLanguage$
			.pipe(
				untilDestroyed(this)
			)
			.subscribe((language) => {
				this.form.patchValue({ languageCode: language });
				this.subject$.next();
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => {
					this.organization = organization;
					this.organizationName = organization.name;
				}),
				tap(() => this.subject$.next()),
				untilDestroyed(this)
			)
			.subscribe();
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { 
			languageCode = LanguagesEnum.ENGLISH, 
			templateType = AccountingTemplateTypeEnum.INVOICE 
		} = this.form.value;
		
		const result = await this.accountingTemplateService.getTemplate({
			languageCode,
			templateType,
			organizationId,
			tenantId
		})
		this.templateEditor.value = result.mjml;
		const html = await this.accountingTemplateService.generateTemplatePreview({
			organization: this.organizationName,
			data: result.mjml,
		});

		this.previewTemplate = this.sanitizer.bypassSecurityTrustHtml(
			html.html
		);
	}

	async onTemplateChange(code: string) {
		this.form.get('mjml').setValue(code);
		const html = await this.accountingTemplateService.generateTemplatePreview({
			organization: this.organizationName,
			data: code,
		});
		this.previewTemplate = this.sanitizer.bypassSecurityTrustHtml(
			html.html
		);
	}

	async onSave() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		await this.accountingTemplateService.saveTemplate({
			...this.form.value,
			organizationId,
			tenantId
		});
	}

	private _initializeForm() {
		this.form = this.fb.group({
			templateType: [AccountingTemplateTypeEnum.INVOICE],
			languageCode: [LanguagesEnum.ENGLISH],
			mjml: ['']
		});
	}

	ngOnDestroy() {}
}
