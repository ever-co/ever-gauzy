import { AfterViewInit, Component, OnDestroy, OnInit, SecurityContext, TemplateRef, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EmailTemplateEnum, IOrganization, LanguagesEnum } from '@gauzy/contracts';
import { NbDialogService, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import 'brace';
import 'brace/ext/language_tools';
import 'brace/mode/handlebars';
import 'brace/theme/sqlserver';
import 'brace/theme/tomorrow_night';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { AceEditorComponent } from 'ngx-ace-editor-wrapper';
import { Store } from '@gauzy/ui-core/core';
import { EmailTemplateService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ToastrService } from '@gauzy/ui-core/core';

/**
 * Themes whose canvas is dark, so the Ace editors have to load a dark syntax theme.
 *
 * Matched by NAME rather than by the theme's `base`: `cosmic` and `material-dark` are
 * both dark yet declare `base: 'default'` (see `theme.material-dark.ts`), so `base` says
 * nothing about the canvas. The list previously stopped at `dark`/`cosmic`, which is why
 * `gauzy-dark` — the app's own dark theme — fell through to the light `sqlserver` theme
 * and rendered both editors as white blocks on a near-black page.
 */
const DARK_CANVAS_THEMES: ReadonlySet<string> = new Set(['dark', 'cosmic', 'gauzy-dark', 'material-dark']);

/** How many templates the grid fetches and renders at once. */
const GRID_CONCURRENCY = 4;

export type EmailTemplatesViewMode = 'grid' | 'editor';

/** One tile of the template grid: the rendered subject and a thumbnail of the body. */
export interface EmailTemplateCard {
	name: EmailTemplateEnum;
	subject: SafeHtml | null;
	/** Raw rendered email; only ever written into a sandboxed iframe by `SandboxedSrcdocDirective`. */
	html: string | null;
	failed: boolean;
}

@UntilDestroy({ checkProperties: true })
@Component({
    templateUrl: './email-templates.component.html',
    styleUrls: ['./email-templates.component.scss'],
    standalone: false
})
export class EmailTemplatesComponent extends TranslationBaseComponent implements OnInit, AfterViewInit, OnDestroy {
	templates: string[] = Object.values(EmailTemplateEnum);
	subject$: Subject<any> = new Subject();

	public previewEmail: SafeHtml;
	public previewSubject: SafeHtml;
	public organization: IOrganization;

	public viewMode: EmailTemplatesViewMode = 'editor';
	public gridCards: EmailTemplateCard[] = [];
	/** Organization + language the grid was last loaded for, so toggling back does not refetch. */
	private gridKey: string;
	/** Bumped on every grid load; responses from an older load are dropped. */
	private gridRun = 0;

	/**
	 * Email Template Mutation Form
	 */
	readonly form: UntypedFormGroup = EmailTemplatesComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: [EmailTemplateEnum.WELCOME_USER],
			languageCode: [LanguagesEnum.ENGLISH],
			subject: [null, [Validators.required, Validators.maxLength(60)]],
			mjml: [null, Validators.required]
		});
	}

	@ViewChild('subjectEditor') subjectEditor: AceEditorComponent;
	@ViewChild('emailEditor') emailEditor: AceEditorComponent;

	constructor(
		readonly translateService: TranslateService,
		private readonly sanitizer: DomSanitizer,
		private readonly store: Store,
		private readonly fb: UntypedFormBuilder,
		private readonly toastrService: ToastrService,
		private readonly emailTemplateService: EmailTemplateService,
		private readonly themeService: NbThemeService,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getTemplate()),
				tap(() => {
					if (this.viewMode === 'grid') {
						void this.loadGrid();
					}
				}),
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
			.subscribe(({ name }: { name: string }) => {
				const editorTheme = DARK_CANVAS_THEMES.has(name) ? 'tomorrow_night' : 'sqlserver';
				this.emailEditor.setTheme(editorTheme);
				this.subjectEditor.setTheme(editorTheme);
			});

		const editorOptions = {
			enableBasicAutocompletion: true,
			enableLiveAutocompletion: true,
			printMargin: false,
			showLineNumbers: true,
			tabSize: 2
		};

		this.emailEditor.getEditor().setOptions(editorOptions);
		this.subjectEditor.getEditor().setOptions({ ...editorOptions, maxLines: 2 });
	}

	async getTemplate() {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { languageCode = LanguagesEnum.ENGLISH, name = EmailTemplateEnum.WELCOME_USER } =
				this.form.getRawValue();
			const result = await this.emailTemplateService.getTemplate({
				languageCode,
				name,
				organizationId,
				tenantId
			});

			this.emailEditor.value = result.template;
			this.subjectEditor.value = result.subject;

			const { html: email } = await this.emailTemplateService.generateTemplatePreview(result.template);
			const { html: subject } = await this.emailTemplateService.generateTemplatePreview(result.subject);
			this.previewEmail = this.sanitizer.bypassSecurityTrustHtml(email);
			this.previewSubject = this.sanitizer.sanitize(SecurityContext.HTML, subject);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async onSubjectChange(code: string) {
		this.form.get('subject').setValue(code);
		this.form.get('subject').updateValueAndValidity();

		const { html } = await this.emailTemplateService.generateTemplatePreview(code);
		this.previewSubject = this.sanitizer.bypassSecurityTrustHtml(html);
	}

	async onEmailChange(code: string) {
		this.form.get('mjml').setValue(code);
		this.form.get('mjml').updateValueAndValidity();

		const { html } = await this.emailTemplateService.generateTemplatePreview(code);
		this.previewEmail = this.sanitizer.bypassSecurityTrustHtml(html);
	}

	setViewMode(mode: EmailTemplatesViewMode) {
		if (this.viewMode === mode) {
			return;
		}
		this.viewMode = mode;
		if (mode === 'grid') {
			void this.loadGrid();
		} else {
			this.resizeEditors();
		}
	}

	/** Template picked from the dropdown: show it in the editor. */
	onTemplatePicked() {
		this.subject$.next(true);
		this.setViewMode('editor');
	}

	/** Grid card clicked: select that template and switch to the editor. */
	openTemplate(name: EmailTemplateEnum) {
		if (this.form.get('name').value !== name) {
			this.form.patchValue({ name });
			this.subject$.next(true);
		}
		this.setViewMode('editor');
	}

	/**
	 * Fetches every template for the current organization + language and renders its
	 * subject and body, a few at a time. Cards fill in as their previews arrive.
	 */
	async loadGrid() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { languageCode = LanguagesEnum.ENGLISH } = this.form.getRawValue();
		const key = `${organizationId}:${languageCode}`;
		if (key === this.gridKey) {
			return;
		}
		this.gridKey = key;
		const run = ++this.gridRun;

		this.gridCards = this.templates.map((name) => ({
			name: name as EmailTemplateEnum,
			subject: null,
			html: null,
			failed: false
		}));

		const cards = this.gridCards;
		// Index of the next card to load, shared by the workers.
		let next = 0;
		const worker = async () => {
			while (next < cards.length && run === this.gridRun) {
				const card = cards[next++];
				try {
					const { subject, template } = await this.emailTemplateService.getTemplate({
						languageCode,
						name: card.name,
						organizationId,
						tenantId
					});
					// The page may have been left, or the grid reloaded, while this was in flight.
					if (run !== this.gridRun) {
						return;
					}
					const [{ html: subjectHtml }, { html: bodyHtml }] = await Promise.all([
						this.emailTemplateService.generateTemplatePreview(subject),
						this.emailTemplateService.generateTemplatePreview(template)
					]);
					if (run !== this.gridRun) {
						return;
					}
					card.subject = this.sanitizer.sanitize(SecurityContext.HTML, subjectHtml);
					card.html = bodyHtml;
				} catch {
					card.failed = true;
				}
			}
		};
		await Promise.all(Array.from({ length: GRID_CONCURRENCY }, worker));
		// A failed load may be retried by toggling the grid again.
		if (run === this.gridRun && this.gridCards.some((card) => card.failed)) {
			this.gridKey = null;
		}
	}

	/** Ace measures its box when shown; it was hidden while the grid was up. */
	private resizeEditors() {
		setTimeout(() => {
			this.emailEditor?.getEditor().resize();
			this.subjectEditor?.getEditor().resize();
		});
	}

	/**
	 * Opens the rendered email at full size, so long templates can be read without
	 * scrolling inside the side-by-side preview pane.
	 */
	openFullPreview(dialog: TemplateRef<unknown>) {
		this.dialogService.open(dialog, { closeOnBackdropClick: true, hasScroll: false });
	}

	selectedLanguage(event) {
		this.form.patchValue({
			languageCode: event.code
		});
	}

	async submitForm() {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			await this.emailTemplateService.saveEmailTemplate({
				...this.form.getRawValue(),
				organizationId,
				tenantId
			});
			// The saved template's grid thumbnail is now stale.
			this.gridKey = null;
			this.toastrService.success('TOASTR.MESSAGE.EMAIL_TEMPLATE_SAVED', {
				templateName: this.getTranslation('EMAIL_TEMPLATES_PAGE.TEMPLATE_NAMES.' + this.form.get('name').value)
			});
		} catch ({ error }) {
			this.toastrService.danger(error);
		}
	}

	ngOnDestroy(): void {
		// Stops any grid load still running: its workers check the run between requests.
		this.gridRun++;
	}
}
