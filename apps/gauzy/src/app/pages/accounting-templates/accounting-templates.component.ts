import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AceEditorComponent } from 'ngx-ace-editor-wrapper';
import { NbThemeService } from '@nebular/theme';
import { AccountingTemplateTypeEnum, IOrganization, LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { AccountingTemplateService, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './accounting-templates.component.html',
	styleUrls: ['./accounting-templates.component.scss']
})
export class AccountingTemplatesComponent implements OnInit, AfterViewInit, OnDestroy {
	previewTemplate: SafeHtml;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateTypes: string[] = Object.values(AccountingTemplateTypeEnum);
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	readonly form: UntypedFormGroup = AccountingTemplatesComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			templateType: [AccountingTemplateTypeEnum.INVOICE],
			languageCode: [LanguagesEnum.ENGLISH],
			mjml: []
		});
	}

	@ViewChild('templateEditor') templateEditor: AceEditorComponent;

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly accountingTemplateService: AccountingTemplateService,
		private readonly store: Store,
		private readonly sanitizer: DomSanitizer,
		private readonly themeService: NbThemeService
	) {}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(async () => await this.getTemplate()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$;
		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization, language]) => !!organization && !!language),
				tap(([organization, language]) => {
					this.organization = organization;
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
			.subscribe(({ name }: { name: 'dark' | 'cosmic' | 'corporate' | 'default' }) => {
				switch (name) {
					case 'dark':
					case 'cosmic':
						this.templateEditor.setTheme('tomorrow_night');
						break;
					default:
						this.templateEditor.setTheme('sqlserver');
						break;
				}
			});

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

		const { languageCode = LanguagesEnum.ENGLISH, templateType = AccountingTemplateTypeEnum.INVOICE } =
			this.form.value;

		const result = await this.accountingTemplateService.getTemplate({
			languageCode,
			templateType,
			organizationId,
			tenantId
		});

		if (!result) {
			this.previewTemplate = null;
			this.templateEditor.value = null;
			return;
		}

		this.templateEditor.value = result.mjml;

		const html = await this.accountingTemplateService.generateTemplatePreview({
			organization: this.organization.name,
			data: result.mjml
		});

		this.previewTemplate = this.sanitizer.bypassSecurityTrustHtml(html.html);
	}

	async onTemplateChange(code: string) {
		if (!this.organization) {
			return;
		}
		this.form.get('mjml').setValue(code);
		this.form.get('mjml').updateValueAndValidity();

		const html = await this.accountingTemplateService.generateTemplatePreview({
			organization: this.organization.name,
			data: code
		});
		this.previewTemplate = this.sanitizer.bypassSecurityTrustHtml(html.html);
	}

	async onSave() {
		if (!this.organization) {
			return;
		}
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
