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

	subject = '';
	template = '';

	name: EmailTemplateNameEnum = EmailTemplateNameEnum.INVITE_USER;
	languageCode: LanguagesEnum = LanguagesEnum.ENGLISH;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateNames: string[] = Object.values(EmailTemplateNameEnum);

	constructor(
		readonly translateService: TranslateService,
		private sanitizer: DomSanitizer,
		private store: Store,
		private fb: FormBuilder,
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
		console.log('changed');
		const result = await this.emailTemplateService.getTemplate({
			languageCode: this.form.get('languageCode').value,
			name: this.form.get('templateName').value,
			organizationId: this.organizationId
		});
		this.subject = result.subject;
		this.template = result.template;

		const {
			html: email
		} = await this.emailTemplateService.generateTemplatePreview(
			this.template
		);
		const {
			html: subject
		} = await this.emailTemplateService.generateTemplatePreview(
			this.subject
		);
		this.previewEmail = this.sanitizer.bypassSecurityTrustHtml(email);
		this.previewSubject = this.sanitizer.sanitize(
			SecurityContext.HTML,
			subject
		);
	}

	private _initializeForm() {
		this.form = this.fb.group({
			templateName: [EmailTemplateNameEnum.WELCOME_USER],
			languageCode: [LanguagesEnum.ENGLISH],
			subject: [this.subject],
			mjml: [this.template]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
