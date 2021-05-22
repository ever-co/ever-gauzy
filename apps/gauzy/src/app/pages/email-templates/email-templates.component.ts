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
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { EmailTemplateService } from '../../@core/services/email-template.service';
import { Store } from '../../@core/services/store.service';
import { ToastrService } from '../../@core/services/toastr.service';
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
	form: FormGroup;

	@ViewChild('subjectEditor') subjectEditor;
	@ViewChild('emailEditor') emailEditor;

	templateNames: string[] = Object.values(EmailTemplateNameEnum);
	subject$: Subject<any> = new Subject();

	constructor(
		readonly translateService: TranslateService,
		private sanitizer: DomSanitizer,
		private store: Store,
		private fb: FormBuilder,
		private toastrService: ToastrService,
		private emailTemplateService: EmailTemplateService,
		private themeService: NbThemeService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this._initializeForm();
		this.subject$
			.pipe(
				debounceTime(500),
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
				tap((organization) => this.organization = organization),
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
			const { languageCode = LanguagesEnum.ENGLISH, name = EmailTemplateNameEnum.WELCOME_USER } = this.form.value;
			console.log({
				languageCode,
				name,
				organizationId,
				tenantId
			});
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

	private _initializeForm() {
		this.form = this.fb.group({
			name: [EmailTemplateNameEnum.WELCOME_USER],
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
