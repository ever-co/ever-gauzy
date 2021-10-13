import {
	AfterViewInit,
	Component,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbThemeService } from '@nebular/theme';
import {
	AccountingTemplateTypeEnum,
	IOrganization,
	LanguagesEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { AccountingTemplateService, Store } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './accounting-templates.component.html',
	styleUrls: ['./accounting-templates.component.scss']
})
export class AccountingTemplatesComponent
	implements OnInit, AfterViewInit, OnDestroy {

	previewTemplate: SafeHtml;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateTypes: string[] = Object.values(AccountingTemplateTypeEnum);
	organizationName: string;
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	@ViewChild('templateEditor') templateEditor;

	readonly form: FormGroup = AccountingTemplatesComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			templateType: [AccountingTemplateTypeEnum.INVOICE],
			languageCode: [LanguagesEnum.ENGLISH],
			mjml: ['']
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly accountingTemplateService: AccountingTemplateService,
		private readonly store: Store,
		private readonly sanitizer: DomSanitizer,
		private readonly themeService: NbThemeService
	) {}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.getTemplate()),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$;
		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				distinctUntilChange(),
				filter(([organization, language]) => !!organization && !!language),
				tap(([organization, language]) => {
					this.organization = organization;
					this.organizationName = organization.name;
					this.form.patchValue({ languageCode: language });
				}),
				tap(() => this.subject$.next(true)),
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
		if (!this.organization) {
			return;
		}

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

	ngOnDestroy() {}
}
