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
} from '@gauzy/contracts';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import 'brace';
import 'brace/ext/language_tools';
import 'brace/mode/handlebars';
import 'brace/theme/sqlserver';
import 'brace/theme/tomorrow_night';
import { distinctUntilChange } from '@gauzy/common-angular';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { EmailTemplateService, Store, ToastrService } from '../../@core/services';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './email-templates.component.html',
	styleUrls: ['./email-templates.component.scss']
})
export class EmailTemplatesComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit, OnDestroy {

	previewEmail: SafeHtml;
	previewSubject: SafeHtml;
	organization: IOrganization;

	@ViewChild('subjectEditor') subjectEditor;
	@ViewChild('emailEditor') emailEditor;

	templateNames: string[] = Object.values(EmailTemplateNameEnum);
	subject$: Subject<any> = new Subject();

	readonly form: FormGroup = EmailTemplatesComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: [EmailTemplateNameEnum.WELCOME_USER],
			languageCode: [LanguagesEnum.ENGLISH],
			subject: ['', [Validators.required, Validators.maxLength(60)]],
			mjml: ['', Validators.required]
		});
	}

	constructor(
		readonly translateService: TranslateService,
		private readonly sanitizer: DomSanitizer,
		private readonly store: Store,
		private readonly fb: FormBuilder,
		private readonly toastrService: ToastrService,
		private readonly emailTemplateService: EmailTemplateService,
		private readonly themeService: NbThemeService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(500),
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
					this.form.patchValue({ languageCode: language });
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
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const {
				languageCode = LanguagesEnum.ENGLISH,
				name = EmailTemplateNameEnum.WELCOME_USER
			} = this.form.value;		
			const result = await this.emailTemplateService.getTemplate({
				languageCode,
				name,
				organizationId,
				tenantId
			})
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
			this.toastrService.danger(error);
		}
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

	selectedLanguage(event) {
		this.form.patchValue({ 
			languageCode: event.code 
		});
	}

	async submitForm() {
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			await this.emailTemplateService.saveEmailTemplate({
				...this.form.value,
				organizationId,
				tenantId
			});
			this.toastrService.success('TOASTR.MESSAGE.EMAIL_TEMPLATE_SAVED', {
				templateName: this.getTranslation(
					'EMAIL_TEMPLATES_PAGE.TEMPLATE_NAMES.' +
						this.form.get('name').value
				)
			});
		} catch ({ error }) {
			this.toastrService.danger(error);
		}
	}

	ngOnDestroy() {}
}
