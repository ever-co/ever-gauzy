export const AccountingTemplatesPage = {
	// The preview is MJML (mjml2html) rendered server-side into nested `table[role="presentation"]`
	// layouts. Simple `mj-text` labels (INVOICE / FROM: / TO: / Bill to) land in a `td[align="left"] > div`;
	// the number/date rows are `mj-text > div(flex) > span > span`, i.e. an extra nesting level. Both
	// selectors are text-filtered by the util verifyText helper, so leftTableDataCss also catches the
	// header labels even though they sit in their own section.
	leftTableDataCss:
		'table[role="presentation"] > tbody > tr > td[align="left"] > div',
	rightTableDataCss:
		'table[role="presentation"] > tbody > tr > td[align="left"] > div > div > span',
	receiptNumberAndPaymentMethodDataCss:
		'table[role="presentation"] > tbody > tr > td[align="right"] > div > div > span',
	// ngx-language-selector is rendered with [template]="'ng-select'", so it emits an <ng-select> whose
	// options (appendTo="body") render as `div.ng-option` in the body overlay.
	languageSelectCss: 'ngx-language-selector ng-select',
	// The inner search input of the language ng-select — used to open it via the keyboard (ng-select
	// opens on MOUSEDOWN and is blocked by fading cdk backdrops, so a coordinate/dispatch click no-ops).
	languageInputCss: 'ngx-language-selector ng-select input',
	// The template picker is an nb-select#templateName; its options are `.option-list nb-option`.
	templateSelectCss: 'nb-select[id="templateName"]',
	languageDropdownOptionCss: 'div.ng-option',
	templateDropdownOptionCss: '.option-list nb-option',
	// Server-side generateTemplatePreview injects imgPath: 'assets/images/logos/ever-large.jpg', so the
	// preview logo <img> carries that literal src (verified in accounting-template.service.ts).
	logoCss: 'img[src="assets/images/logos/ever-large.jpg"]',
	// The page header (MENU.SETTINGS / Accounting Templates) — waited on after navigation before interacting.
	headerCss: 'ngx-header-title',
	// The green Save button in the template card header (<button nbButton status="success">).
	saveBtnCss: 'button[status="success"]'
};
