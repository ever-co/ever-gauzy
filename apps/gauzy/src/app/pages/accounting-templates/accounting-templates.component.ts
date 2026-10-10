import { AfterViewInit, Component, inject, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AceEditorComponent } from 'ngx-ace-editor-wrapper';
import { NbDialogService, NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
// Brace ships modes and themes as separate side-effect modules. This page is its own lazy
// chunk, so it cannot rely on the email-templates page having pulled them in — without
// these the editor silently falls back to plain text on the light default theme.
import 'brace';
import 'brace/ext/language_tools';
import 'brace/mode/handlebars';
import 'brace/theme/sqlserver';
import 'brace/theme/tomorrow_night';
import { AccountingTemplateTypeEnum, IOrganization, LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { AccountingTemplateService, Store, ToastrService } from '@gauzy/ui-core/core';

/**
 * Themes whose canvas is dark, so the Ace editor has to load a dark syntax theme.
 *
 * Matched by NAME rather than by the theme's `base`: `cosmic` and `material-dark` are
 * both dark yet declare `base: 'default'` (see `theme.material-dark.ts`), so `base` says
 * nothing about the canvas. The list previously stopped at `dark`/`cosmic`, which is why
 * `gauzy-dark` — the app's own dark theme — fell through to the light `sqlserver` theme
 * and rendered the HTML editor as a white block on a near-black page.
 */
const DARK_CANVAS_THEMES: ReadonlySet<string> = new Set(['dark', 'cosmic', 'gauzy-dark', 'material-dark']);

export type AccountingTemplatesViewMode = 'grid' | 'editor';

/** One tile of the template grid: a thumbnail of the rendered template. */
export interface AccountingTemplateCard {
	name: AccountingTemplateTypeEnum;
	/** Rendered template as returned by the API. */
	source: string | null;
	/**
	 * `source` plus the current theme's colours; only ever written into a sandboxed
	 * iframe by `SandboxedSrcdocDirective`.
	 */
	html: string | null;
	/** The organization has no template of this type in this language. */
	empty: boolean;
	failed: boolean;
}

@UntilDestroy({ checkProperties: true })
@Component({
    templateUrl: './accounting-templates.component.html',
    styleUrls: ['./accounting-templates.component.scss'],
    standalone: false,
    // Asks the settings shell for a definite height (see settings.component.scss), so
    // the card fills the content area and the panes scroll instead of the page.
    host: { class: 'settings-page-fill' }
})
export class AccountingTemplatesComponent implements OnInit, AfterViewInit, OnDestroy {
	previewTemplate: SafeHtml;
	languageCodes: string[] = Object.values(LanguagesEnum);
	templateTypes: string[] = Object.values(AccountingTemplateTypeEnum);
	organization: IOrganization;
	subject$: Subject<any> = new Subject();
	saving = false;

	viewMode: AccountingTemplatesViewMode = 'editor';
	gridCards: AccountingTemplateCard[] = [];
	/** Organization + language the grid was last loaded for, so toggling back does not refetch. */
	private gridKey: string;
	/** Bumped on every grid load and on destroy; responses from an older load are dropped. */
	private gridRun = 0;

	private editorResizeObserver: ResizeObserver;

	private readonly dialogService = inject(NbDialogService);
	private readonly toastrService = inject(ToastrService);
	private readonly translateService = inject(TranslateService);

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
				this.templateEditor.setTheme(DARK_CANVAS_THEMES.has(name) ? 'tomorrow_night' : 'sqlserver');
				// The theme's CSS variables switch with the body class; read them after it lands.
				setTimeout(() => this.rethemeThumbnails());
			});

		const editorOptions = {
			enableBasicAutocompletion: true,
			enableLiveAutocompletion: true,
			printMargin: false,
			showLineNumbers: true,
			tabSize: 2
		};

		this.templateEditor.getEditor().setOptions(editorOptions);

		// Ace sizes its rows from the box it measures, once. The frame settles after that
		// (fonts, the preview filling in, the grid toggle, window resizes), and Ace kept
		// drawing a handful of rows at the top of a much taller frame. Re-measure whenever
		// the box changes size.
		const editorElement = this.templateEditor.getEditor().container;
		this.editorResizeObserver = new ResizeObserver(() => this.templateEditor?.getEditor().resize());
		this.editorResizeObserver.observe(editorElement);
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
		if (!this.organization || this.saving) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const templateName = this.translateService.instant(
			'ACCOUNTING_TEMPLATES_PAGE.TEMPLATE_NAMES.' + this.form.get('templateType').value
		);

		this.saving = true;
		try {
			await this.accountingTemplateService.saveTemplate({
				...this.form.value,
				organizationId,
				tenantId
			});
			// The saved template's grid thumbnail is now stale. Drop any grid load still in
			// flight (it may have fetched the template before the save landed) and, if the
			// grid is open, load it again so the card shows what was saved.
			this.gridRun++;
			this.gridKey = null;
			if (this.viewMode === 'grid') {
				void this.loadGrid();
			}
			this.toastrService.success('ACCOUNTING_TEMPLATES_PAGE.SAVED', { templateName });
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.saving = false;
		}
	}

	setViewMode(mode: AccountingTemplatesViewMode) {
		if (this.viewMode === mode) {
			return;
		}
		this.viewMode = mode;
		if (mode === 'grid') {
			void this.loadGrid();
		}
	}

	/** Template picked from the dropdown: show it in the editor. */
	onTemplatePicked() {
		this.subject$.next(true);
		this.setViewMode('editor');
	}

	/** Grid card clicked: select that template and switch to the editor. */
	openTemplate(templateType: AccountingTemplateTypeEnum) {
		if (this.form.get('templateType').value !== templateType) {
			this.form.patchValue({ templateType });
			this.subject$.next(true);
		}
		this.setViewMode('editor');
	}

	/**
	 * Fetches every template type for the current organization + language and renders
	 * it, one card at a time. Cards fill in as their previews arrive.
	 */
	async loadGrid() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId, name: organizationName } = this.organization;
		const { languageCode = LanguagesEnum.ENGLISH } = this.form.value;
		const key = `${organizationId}:${languageCode}`;
		if (key === this.gridKey) {
			return;
		}
		this.gridKey = key;
		const run = ++this.gridRun;

		this.gridCards = this.templateTypes.map((name) => ({
			name: name as AccountingTemplateTypeEnum,
			source: null,
			html: null,
			empty: false,
			failed: false
		}));

		for (const card of this.gridCards) {
			try {
				const template = await this.accountingTemplateService.getTemplate({
					languageCode,
					templateType: card.name,
					organizationId,
					tenantId
				});
				// The page may have been left, or the grid reloaded, while this was in flight.
				if (run !== this.gridRun) {
					return;
				}
				if (!template?.mjml) {
					card.empty = true;
					continue;
				}
				const { html } = await this.accountingTemplateService.generateTemplatePreview({
					organization: organizationName,
					data: template.mjml
				});
				if (run !== this.gridRun) {
					return;
				}
				const source = await this.inlineAppImages(html);
				if (run !== this.gridRun) {
					return;
				}
				card.source = source;
				card.html = this.themeThumbnail(source);
			} catch {
				card.failed = true;
			}
		}
		// A failed load may be retried by toggling the grid again.
		if (run === this.gridRun && this.gridCards.some((card) => card.failed)) {
			this.gridKey = null;
		}
	}

	/**
	 * Embeds the template's own images (the organization logo, `assets/images/...`) as
	 * data URLs.
	 *
	 * The sandboxed thumbnail has an opaque origin, so it cannot resolve the relative path,
	 * and even an absolute app URL is a cross-site request from it, which the dev server
	 * answers with 403. Fetching from the page (same origin) and inlining the result keeps
	 * the frame fully sandboxed. Images on other hosts are left as they are; a failed fetch
	 * leaves that image unchanged.
	 */
	private async inlineAppImages(html: string): Promise<string> {
		// Built in one expression and never changed afterwards.
		const sources = new Set(Array.from(html.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/gi), (match) => match[1]));
		let result = html;
		for (const src of sources) {
			if (src.startsWith('data:')) {
				continue;
			}
			const url = new URL(src, document.baseURI);
			if (url.origin !== location.origin) {
				continue;
			}
			const dataUrl = await this.toDataUrl(url.href);
			if (dataUrl) {
				result = result.split(`src="${src}"`).join(`src="${dataUrl}"`);
			}
		}
		return result;
	}

	/** Cached per URL: the three templates share one logo. */
	private readonly imageCache = new Map<string, Promise<string | null>>();

	private toDataUrl(href: string): Promise<string | null> {
		if (!this.imageCache.has(href)) {
			const load = fetch(href)
				.then((response) => (response.ok ? response.blob() : null))
				.then(
					(blob) =>
						blob &&
						new Promise<string | null>((resolve) => {
							const reader = new FileReader();
							reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
							reader.onerror = () => resolve(null);
							reader.readAsDataURL(blob);
						})
				)
				.catch(() => null);
			this.imageCache.set(href, load);
		}
		return this.imageCache.get(href);
	}

	/**
	 * Gives a grid thumbnail the same light / dark look as the Template Preview.
	 *
	 * The thumbnail lives in a sandboxed iframe, out of reach of the page's styles, so the
	 * theme's colours are resolved here and written into the document as a style block.
	 * `!important` beats the default `color:#000000` MJML writes inline on every text block;
	 * colours the user wrote into the template are left alone, as in the Template Preview.
	 */
	private themeThumbnail(source: string): string {
		const styles = getComputedStyle(document.body);
		// Theme values only; anything that could close the rule or the tag is dropped.
		const token = (name: string, fallback: string) =>
			(styles.getPropertyValue(name).trim() || fallback).replace(/[^#\w\s(),.%-]/g, '');
		const surface = token('--gauzy-card-1', token('--background-basic-color-1', '#ffffff'));
		const text = token('--text-basic-color', '#222b45');
		const link = token('--text-primary-color', text);
		const hairline = token('--gauzy-border-default-color', token('--border-basic-color-3', '#e4e9f2'));
		const style =
			`<style>html,body{background:${surface} !important;color:${text};}` +
			`[style^="color:#000000"],[style*=";color:#000000"]{color:${text} !important;}` +
			`a:not([style*="color"]){color:${link} !important;}` +
			`[style*="border"]{border-color:${hairline} !important;}</style>`;
		return source.includes('</head>') ? source.replace('</head>', style + '</head>') : style + source;
	}

	/** Re-applies the current theme to the thumbnails already rendered. */
	private rethemeThumbnails() {
		for (const card of this.gridCards) {
			if (card.source) {
				card.html = this.themeThumbnail(card.source);
			}
		}
	}

	/**
	 * Opens the rendered template at full size, so a long invoice can be read without
	 * scrolling inside the side-by-side preview pane.
	 */
	openFullPreview(dialog: TemplateRef<unknown>) {
		this.dialogService.open(dialog, { closeOnBackdropClick: true, hasScroll: false });
	}

	ngOnDestroy() {
		// Stops a grid load still running: it checks the run between requests.
		this.gridRun++;
		this.editorResizeObserver?.disconnect();
	}
}
