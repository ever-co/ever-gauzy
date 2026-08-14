import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyTextNotExisting,
	verifyText,
	verifyByText,
	dispatchClick,
	waitForSpinnerGone,
	waitForDropdownToLoad
} from '../util';
import { selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ProposalsPage } from '../../../src/support/Base/pageobjects/ProposalsPageObject';

// Shared ga-rich-text-editor (TipTap v3) editable — a plain contenteditable div in the MAIN frame
// (no iframe: the legacy editor's wysiwyg iframe is gone). Addressed by DOM order: editor index 0
// = Job Post Content, index 1 = Proposal Content (two independent editors in the register/edit form).
const richTextEditorCss = 'ga-rich-text-editor .ProseMirror';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const registerProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.registerProposalButtonCss);
};

export const clickRegisterProposalButton = async () => {
	// Add is a routerLink button to /pages/sales/proposals/register. This runs right after addEmployee
	// closes its dialog, leaving a fading cdk-overlay backdrop that swallows a coordinate (force) click,
	// so the router never navigates (the observed failure: still on the list, ga-employee-selector absent).
	// dispatchEvent('click') fires on the element directly and bypasses the backdrop, so navigation fires.
	await waitForSpinnerGone();
	await dispatchClick(ProposalsPage.registerProposalButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	// ga-employee-selector is an <ng-select> (opens on mousedown, options appendTo body as div.ng-option).
	// A click is backdrop-blocked / can close the panel, so open it via the keyboard: focus the inner
	// <input> (focusing the host leaves the input unfocused so ArrowDown goes to <body>), then ArrowDown.
	await waitForSpinnerGone();
	await getPage().locator(`${ProposalsPage.selectEmployeeDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectEmployeeFromDropdown = async (index) => {
	const page = getPage();
	const option = page.locator(ProposalsPage.selectEmployeeDropdownOptionCss);
	// Re-open the employee ng-select via keyboard until the options render, then pick one.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${ProposalsPage.selectEmployeeDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(ProposalsPage.selectEmployeeDropdownOptionCss, index);
};

export const selectContactFromDropdown = async (name) => {
	// ga-contact-select is an <ng-select [addTag]> (opens on mousedown, options appendTo body). Type a
	// name to create a NEW contact via the add-tag option — registerProposal() dereferences
	// organizationContact.id, so a contact must exist or the create silently no-ops.
	const page = getPage();
	const input = page.locator(`${ProposalsPage.contactDropdownCss} input`).first();
	await waitForSpinnerGone();
	await input.focus().catch(() => {});
	await input.fill('').catch(() => {});
	await input.pressSequentially(String(name), { delay: 30 }).catch(() => {});
	await page.waitForTimeout(600);
	// Pick the add-tag option ("Add <name>...") / any matching option from the body-appended panel.
	const option = page.locator(ProposalsPage.contactDropdownOptionCss).filter({ hasText: String(name) });
	await option.first().click({ force: true });
	await page.waitForTimeout(400);
};

// Fill a ga-rich-text-editor's content (by DOM order). Unlike the legacy iframe-body fill
// (which never fired the editor's change event, leaving the required jobPostContent/proposalContent
// controls empty and the Save button [disabled]), typing/filling the .ProseMirror contenteditable
// feeds native beforeinput events straight into TipTap, whose update the component's
// ControlValueAccessor propagates to the reactive form — so the required controls really receive the
// value. Addressing by index keeps this stable: editor index 0 = Job Post Content, index 1 =
// Proposal Content.
const setRichTextEditorData = async (index: number, data: string) => {
	const page = getPage();
	// Editors instantiate async (lazy preset chunk) — wait until the nth editable exists.
	const editable = page.locator(richTextEditorCss).nth(index);
	await editable.waitFor({ state: 'visible', timeout: 24_000 }).catch(() => {});
	await editable.fill(String(data));
};

export const enterJobPostContentData = async (data) => {
	// jobPostContent is the FIRST rich-text editor — required field.
	await setRichTextEditorData(0, data);
};

export const enterProposalContentData = async (data) => {
	// proposalContent is the SECOND rich-text editor — required field.
	await setRichTextEditorData(1, data);
};

export const jobPostInputVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.jobPostUrlInputCss);
};

export const enterJobPostInputData = async (data) => {
	await clearField(ProposalsPage.jobPostUrlInputCss);
	await enterInput(ProposalsPage.jobPostUrlInputCss, data);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(ProposalsPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ProposalsPage.dateInputCss, date);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// ga-tags-color-input is an <ng-select id="addTags"> (opens on mousedown, options appendTo body).
	// A force-click lands on a leaked cdk-overlay backdrop / can dismiss the form — open via keyboard:
	// focus the inner <input> (host focus leaves the input unfocused so ArrowDown hits <body>), ArrowDown.
	await waitForSpinnerGone();
	await getPage().locator(`${ProposalsPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index) => {
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(ProposalsPage.addTagsDropdownCss, ProposalsPage.tagsDropdownOption, index);
};

export const jobPostContentTextareaVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.jobPostContentInputCss);
};

export const enterJobPostContentInputData = async (data, index) => {
	await setRichTextEditorData(index, String(data));
};

export const proposalContentTextareaVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.proposalContentInputCss);
};

export const enterProposalContentInputData = async (data) => {
	await clickButton(ProposalsPage.proposalContentInputCss);
	await clearField(ProposalsPage.proposalContentInputCss);
	await enterInput(ProposalsPage.proposalContentInputCss, data);
};

export const saveProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.saveProposalButtonCss);
};

export const clickSaveProposalButton = async () => {
	// The register/edit Save button is [disabled]="form.invalid"; a force-click on a disabled button is a
	// no-op (the (click) handler never fires). After the rich-text editor fill propagates to the required
	// jobPostContent/proposalContent controls, Angular needs a tick to flip [disabled] — so wait for the
	// button to actually be enabled before clicking, otherwise we'd silently stay on the form.
	const page = getPage();
	await waitForSpinnerGone();
	await page
		.locator(ProposalsPage.saveProposalButtonCss)
		.first()
		.waitFor({ state: 'visible' })
		.catch(() => {});
	for (let i = 0; i < 16; i++) {
		if (await page.locator(ProposalsPage.saveProposalButtonCss).first().isEnabled().catch(() => false)) break;
		await page.waitForTimeout(500);
	}
	await clickButton(ProposalsPage.saveProposalButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	// Selecting a grid row TOGGLES selection and enables the toolbar (Details/Edit/status/delete are
	// [disabled] until a proposal is selected). Settle the grid first, then click ONCE and poll the
	// Details button's real enabled state; only re-click if selection was lost — never rapid re-click
	// (a second immediate click would toggle the row back off).
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(ProposalsPage.selectTableRowCss).nth(index);
	const details = page.locator(ProposalsPage.detailsButtonCss).first();
	for (let i = 0; i < 4; i++) {
		await row.click({ force: true }).catch(() => {});
		// isEnabled() reads the live disabled state via a Playwright locator (supports :has-text); poll
		// briefly so the toolbar binding (disableButton) has time to flip after the row-select event.
		let enabled = false;
		for (let j = 0; j < 8; j++) {
			if (await details.isEnabled().catch(() => false)) {
				enabled = true;
				break;
			}
			await page.waitForTimeout(500);
		}
		if (enabled) break;
		await page.waitForTimeout(800);
	}
	await details.waitFor({ state: 'visible' }).catch(() => {});
};

export const detailsButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.detailsButtonCss);
};

export const clickDetailsButton = async (index) => {
	// Toolbar Details navigates to the details route; dispatchClick bypasses any lingering overlay backdrop.
	await waitForSpinnerGone();
	await dispatchClick(ProposalsPage.detailsButtonCss);
};

export const editProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.editProposalButtonCss);
};

export const clickEditProposalButton = async () => {
	// Edit (on the details page header) navigates to the edit route — dispatchClick avoids backdrop interception.
	// ProposalDetailsComponent.edit() no-ops unless this.proposal is set, and that is populated
	// asynchronously (resolver fetch + route.data debounceTime(100)) AFTER the Edit button already
	// renders/becomes visible. A single dispatch therefore races the proposal resolution and can fire
	// while this.proposal is still undefined → no navigation, then jobPostInputVisible() times out on an
	// edit form that never loads. Retry the dispatch until the edit route/form actually renders.
	const page = getPage();
	await waitForSpinnerGone();
	const jobPostInput = page.locator(ProposalsPage.jobPostUrlInputCss).first();
	for (let i = 0; i < 8; i++) {
		await dispatchClick(ProposalsPage.editProposalButtonCss);
		try {
			await jobPostInput.waitFor({ state: 'visible', timeout: 3_000 });
			return;
		} catch {
			await page.waitForTimeout(500);
		}
	}
};

export const markAsStatusButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.markAsStatusButtonCss);
};

export const clickMarkAsStatusButton = async () => {
	// Opens the status ActionConfirmation dialog — dispatchClick so the toolbar click isn't backdrop-blocked.
	await waitForSpinnerGone();
	await dispatchClick(ProposalsPage.markAsStatusButtonCss);
};

export const confirmStatusButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.confirmStatusButtonCss);
};

export const clickConfirmStatusButton = async () => {
	await clickButton(ProposalsPage.confirmStatusButtonCss);
};

export const deleteProposalButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.deleteProposalButtonCss);
};

export const clickDeleteProposalButton = async () => {
	// Opens the DeleteConfirmation dialog — dispatchClick so the toolbar click isn't backdrop-blocked.
	await waitForSpinnerGone();
	await dispatchClick(ProposalsPage.deleteProposalButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(ProposalsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(ProposalsPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ProposalsPage.toastrMessageCss);
};

export const verifyProposalIsDeleted = async (text) => {
	await verifyTextNotExisting(ProposalsPage.verifyProposalCss, text);
};

export const verifyProposalExists = async (text) => {
	await verifyText(ProposalsPage.verifyProposalCss, text);
};

export const verifyProposalAccepted = async () => {
	await verifyElementIsVisible(ProposalsPage.acceptedProposalCss);
};

export const manageTemplatesBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.manageTemplatesBtnCss);
};

export const clickManageTemplatesBtn = async (index) => {
	await clickButtonByIndex(ProposalsPage.manageTemplatesBtnCss, index);
};

export const addProposalTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.addProposalTemplateBtnCss);
};

export const clickAddProposalTemplateBtn = async () => {
	await clickButton(ProposalsPage.addProposalTemplateBtnCss);
};

export const templateNameInputVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.templateNameInputCss);
};

export const enterTemplateName = async (name) => {
	await clearField(ProposalsPage.templateNameInputCss);
	await enterInput(ProposalsPage.templateNameInputCss, name);
};

export const saveTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.saveTemplateBtnCss);
};

export const clickSaveTemplateBtn = async () => {
	await clickButton(ProposalsPage.saveTemplateBtnCss);
};

export const editTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.editProposalTemplateBtnCss);
};

export const clickEditTemplateBtn = async (index) => {
	await clickButtonByIndex(ProposalsPage.editProposalTemplateBtnCss, index);
};

export const deleteTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.deleteProposalTemplateBtnCss);
};

export const clickDeleteTemplateBtn = async () => {
	await clickButton(ProposalsPage.deleteProposalTemplateBtnCss);
};

export const rejectDeleteTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.rejectDeleteBtnCss);
};

export const confirmDeleteTemplateBtnVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.confirmDeleteTemplateBtnCss);
};

export const clickConfirmDeleteTemplateBtn = async () => {
	await clickButton(ProposalsPage.confirmDeleteTemplateBtnCss);
};

export const enterProposalTemplateContent = async (data, index) => {
	await setRichTextEditorData(index, String(data));
};

export const verifyProposalTemplate = async (name) => {
	await verifyText(ProposalsPage.verifyProposalTemplateCss, name);
};

export const employeeMultiSelectVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.employeeMultiSelectCss);
};

export const clickEmployeeMultiSelect = async () => {
	await clickButton(ProposalsPage.employeeMultiSelectCss);
};

export const selectEmployeeFromMultiSelectDropdown = async (index) => {
	await clickButtonByIndex(ProposalsPage.employeeMultiSelectDropdownOptionCss, index);
};

export const verifyEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ProposalsPage.selectEmployeeDropdownOptionCss);
	await waitForDropdownToLoad(ProposalsPage.selectEmployeeDropdownOptionCss);
};

export const verifyHeaderTitle = async (text: string) => {
	await verifyByText(ProposalsPage.headerTitleCss, text);
};
