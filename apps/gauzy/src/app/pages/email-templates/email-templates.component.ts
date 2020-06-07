import {
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	SecurityContext,
	ViewChild,
	AfterViewInit
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EmailTemplateNameEnum, LanguagesEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { fromEvent, Subject } from 'rxjs';
import {
	debounceTime,
	distinctUntilChanged,
	map,
	takeUntil
} from 'rxjs/operators';
import { EmailTemplateService } from '../../@core/services/email-template.service';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NbToastrService } from '@nebular/theme';

@Component({
	templateUrl: './email-templates.component.html',
	styleUrls: ['./email-templates.component.scss']
})
export class EmailTemplatesComponent extends TranslationBaseComponent
	implements OnInit, AfterViewInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	previewEmail: SafeHtml;
	previewSubject: SafeHtml;
	organizationName: string;
	organizationId: string;
	form: FormGroup;

	@ViewChild('mjmlEditor', { read: ElementRef }) mjmlEditor: ElementRef;
	@ViewChild('subjectEditor', { read: ElementRef }) subjectEditor: ElementRef;

	name: EmailTemplateNameEnum = EmailTemplateNameEnum.INVITE_USER;
	languageCode: LanguagesEnum = LanguagesEnum.ENGLISH;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateNames: string[] = Object.values(EmailTemplateNameEnum);

	constructor(
		readonly translateService: TranslateService,
		private sanitizer: DomSanitizer,
		private store: Store,
		private fb: FormBuilder,
		private toastrService: NbToastrService,
		private emailTemplateService: EmailTemplateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.organizationName = org.name;
					this.organizationId = org.id;
					this.getTemplate();
				}
			});
		this._initializeForm();
	}

	ngAfterViewInit() {
		fromEvent(this.mjmlEditor.nativeElement, 'keyup')
			.pipe(
				takeUntil(this._ngDestroy$),
				map((event: any) => event.target.value),
				debounceTime(500),
				distinctUntilChanged()
			)
			.subscribe(async (text) => {
				const {
					html
				} = await this.emailTemplateService.generateTemplatePreview(
					text
				);
				this.previewEmail = this.sanitizer.bypassSecurityTrustHtml(
					html
				);
			});

		fromEvent(this.subjectEditor.nativeElement, 'keyup')
			.pipe(
				takeUntil(this._ngDestroy$),
				map((event: any) => event.target.value),
				debounceTime(500),
				distinctUntilChanged()
			)
			.subscribe(async (text) => {
				const {
					html
				} = await this.emailTemplateService.generateTemplatePreview(
					text
				);
				this.previewSubject = this.sanitizer.sanitize(
					SecurityContext.HTML,
					html
				);
			});
		this.getTemplate();
	}

	async getTemplate() {
		const result = this.form
			? await this.emailTemplateService.getTemplate({
					languageCode: this.form.get('languageCode').value,
					name: this.form.get('templateName').value,
					organizationId: this.organizationId
			  })
			: await this.emailTemplateService.getTemplate({
					languageCode: LanguagesEnum.ENGLISH,
					name: EmailTemplateNameEnum.WELCOME_USER,
					organizationId: this.organizationId
			  });
		this.form.get('mjml').setValue(result.template);
		this.form.get('subject').setValue(result.subject);

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
	}

	async submitForm() {
		try {
			await this.emailTemplateService.saveEmailTemplate({
				languageCode: this.form.get('languageCode').value,
				mjml: this.form.get('mjml').value,
				name: this.form.get('templateName').value,
				organizationId: this.organizationId,
				subject: this.form.get('subject').value
			});
			this.toastrService.primary(
				this.getTranslation('TOASTR.MESSAGE.EMAIL_TEMPLATE_SAVED', {
					templateName: this.form.get('templateName').value
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

	private _initializeForm() {
		this.form = this.fb.group({
			templateName: [EmailTemplateNameEnum.PASSWORD_RESET],
			languageCode: [LanguagesEnum.ENGLISH],
			subject: [],
			mjml: []
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
