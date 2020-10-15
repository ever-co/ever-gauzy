import {
	AfterViewInit,
	Component,
	OnDestroy,
	OnInit,
	SecurityContext,
	ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
	EmailTemplateNameEnum,
	IOrganization,
	LanguagesEnum
} from '@gauzy/models';
import { NbThemeService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import 'brace';
import 'brace/ext/language_tools';
import 'brace/mode/handlebars';
import 'brace/theme/sqlserver';
import 'brace/theme/tomorrow_night';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmailTemplateService } from '../../@core/services/email-template.service';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
@Component({
	templateUrl: './email-templates.component.html',
	styleUrls: ['./email-templates.component.scss']
})
export class EmailTemplatesComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	previewEmail: SafeHtml;
	previewSubject: SafeHtml;
	organizationName: string;
	organizationId: string;
	organization: IOrganization;
	form: FormGroup;

	@ViewChild('subjectEditor') subjectEditor;
	@ViewChild('emailEditor') emailEditor;

	languageCodes: string[] = Object.values(LanguagesEnum);
	templateNames: string[] = Object.values(EmailTemplateNameEnum);

	constructor(
		readonly translateService: TranslateService,
		private sanitizer: DomSanitizer,
		private store: Store,
		private fb: FormBuilder,
		private toastrService: NbToastrService,
		private emailTemplateService: EmailTemplateService,
		private themeService: NbThemeService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (org) => {
				if (org) {
					this.organization = org;
					this.organizationName = org.name;
					this.organizationId = org.id;
					await this.getTemplate();
				}
			});

		this._initializeForm();
	}

	ngAfterViewInit() {
		this.themeService
			.getJsTheme()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(
				({
					name
				}: {
					name: 'dark' | 'cosmic' | 'corporate' | 'default';
				}) => {
					switch (name) {
						case 'dark':
						case 'cosmic':
							this.emailEditor.setTheme('tomorrow_night');
							this.subjectEditor.setTheme('tomorrow_night');
							break;
						default:
							this.emailEditor.setTheme('sqlserver');
							this.subjectEditor.setTheme('sqlserver');
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

		this.emailEditor.getEditor().setOptions(editorOptions);
		this.subjectEditor
			.getEditor()
			.setOptions({ ...editorOptions, maxLines: 2 });
	}

	async getTemplate() {
		try {
			const { id: organizationId, tenantId } = this.organization;
			const result = this.form
				? await this.emailTemplateService.getTemplate({
						languageCode: this.form.get('languageCode').value,
						name: this.form.get('name').value,
						organizationId,
						tenantId
				  })
				: await this.emailTemplateService.getTemplate({
						languageCode: LanguagesEnum.ENGLISH,
						name: EmailTemplateNameEnum.WELCOME_USER,
						organizationId,
						tenantId
				  });
			this.emailEditor.value = result.template;
			this.subjectEditor.value = result.subject;

			const {
				html: email
			} = await this.emailTemplateService.generateTemplatePreview(
				result.template
			);
			const {
				html: subject
			} = await this.emailTemplateService.generateTemplatePreview(
				result.subject
			);
			this.previewEmail = this.sanitizer.bypassSecurityTrustHtml(email);

			this.previewSubject = this.sanitizer.sanitize(
				SecurityContext.HTML,
				subject
			);
		} catch (error) {
			this.toastrService.danger(
				error.error.message || error,
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: [EmailTemplateNameEnum.PASSWORD_RESET],
			languageCode: [LanguagesEnum.ENGLISH],
			subject: ['', [Validators.required, Validators.maxLength(60)]],
			mjml: ['', Validators.required]
		});
	}

	async onSubjectChange(code: string) {
		this.form.get('subject').setValue(code);
		const {
			html
		} = await this.emailTemplateService.generateTemplatePreview(code);
		this.previewSubject = this.sanitizer.bypassSecurityTrustHtml(html);
	}

	async onEmailChange(code: string) {
		this.form.get('mjml').setValue(code);
		const {
			html
		} = await this.emailTemplateService.generateTemplatePreview(code);
		this.previewEmail = this.sanitizer.bypassSecurityTrustHtml(html);
	}

	async submitForm() {
		try {
			const { id: organizationId, tenantId } = this.organization;
			await this.emailTemplateService.saveEmailTemplate({
				...this.form.value,
				organizationId,
				tenantId
			});
			this.toastrService.primary(
				this.getTranslation('TOASTR.MESSAGE.EMAIL_TEMPLATE_SAVED', {
					templateName: this.getTranslation(
						'EMAIL_TEMPLATES_PAGE.TEMPLATE_NAMES.' +
							this.form.get('name').value
					)
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch ({ error }) {
			this.toastrService.danger(
				error.message || error,
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
