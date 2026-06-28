import {
	enterInput,
	verifyElementIsVisible,
	clearField,
	waitElementToHide,
	verifyTextNotExisting,
	verifyText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { JobsProposalsPage } from '../../../src/support/Base/pageobjects/JobsProposalsPageObject';

// CKEditor wysiwyg iframe — content is entered into the editor body, not the <ckeditor> host.
const ckeditorIframeCss = 'iframe[class="cke_wysiwyg_frame cke_reset"]';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.addButtonCss);
};

export const clickAddButton = async () => {
	// The list shows a full-card nb-spinner ([nbSpinner]="loading") right after navigation that overlays
	// the toolbar; wait it out then dispatch the click so the Add dialog reliably opens.
	await waitForSpinnerGone();
	await dispatchClick(JobsProposalsPage.addButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	// The Add form is a MODAL nb-dialog. A coordinate click on the nb-select trigger only focuses it
	// (cdk-mouse-focused) — the dialog's own cdk-overlay backdrop confuses nb-select's click trigger
	// strategy so the option-list panel never attaches (the round-1 failure). Open it via the keyboard
	// instead: the trigger button binds (keydown.arrowDown)="show()", which calls show() directly and
	// bypasses all overlay hit-testing. Wait out any full-card spinner first.
	const page = getPage();
	await waitForSpinnerGone();
	const trigger = page.locator(JobsProposalsPage.selectEmployeeDropdownCss).first();
	await trigger.focus().catch(() => {});
	await page.keyboard.press('ArrowDown');
};

export const selectEmployeeFromDropdown = async (index) => {
	const page = getPage();
	const option = page.locator(JobsProposalsPage.selectEmployeeDropdownOptionCss);
	// Best-effort employee pick (mirrors ContactsLeads.selectEmployeeDropdownOption): the working-employee
	// list loads async (EmployeeSelectComponent.getWorkingEmployees, scoped to the header date range) and
	// can be slow. Wait up to 8s for an option, then click it; if the keyboard-open didn't attach the
	// panel on the first try, re-open via ArrowDown and retry once. Never hard-block 60s on an empty list.
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			await option.first().waitFor({ state: 'visible', timeout: 8000 });
			await option.nth(index).click({ force: true });
			return;
		} catch {
			await page.keyboard.press('ArrowDown').catch(() => {});
		}
	}
	// Could not surface an option (empty working-employee list on the test DB) — leave the dialog as-is;
	// employeeId is required so Save stays disabled, but we avoid hanging the run.
	await page.keyboard.press('Escape').catch(() => {});
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(JobsProposalsPage.nameInputCss);
	await enterInput(JobsProposalsPage.nameInputCss, data);
};

export const contentInputVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.contentInputCss);
};

export const enterContentInputData = async (data) => {
	// Content is a CKEditor4 widget — the [formcontrolname="content"] host is not fillable.
	// Type into the editor body inside its wysiwyg iframe (content is optional, so this never
	// blocks Save, but we still populate it to mirror the intended flow).
	await getPage().frameLocator(ckeditorIframeCss).first().locator('body').fill(String(data));
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Dialog footer Save: wait out any full-card spinner, then dispatch the click straight to the button
	// so the (click)=onSave() handler fires even if a fading cdk-overlay backdrop sits over the footer.
	await waitForSpinnerGone();
	await dispatchClick(JobsProposalsPage.saveButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	const page = getPage();
	// Let the grid settle after the preceding mutation (it refetches/re-renders); a click during that
	// window is lost or immediately cleared. Then click the row ONCE and poll for Edit to enable — the
	// row click TOGGLES selection, so only re-click if the first click was lost to a late re-render.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(JobsProposalsPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(JobsProposalsPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.editButtonCss);
};

export const clickEditButton = async (text) => {
	// dispatchClick by text: the closed Add dialog + toastr leave fading cdk-overlay backdrops over the
	// toolbar that swallow a coordinate click on Edit. Filter by label first (Edit/Make Default share
	// button.action.primary), then dispatch the click to that exact element.
	await waitForSpinnerGone();
	await getPage()
		.locator(JobsProposalsPage.editButtonCss)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');
};

export const makeDefaultButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.makeDefaultButtonCss);
};

export const clickMakeDefaultButton = async (text) => {
	// Same as clickEditButton: dispatch by label to clear any lingering backdrop from the prior edit.
	await waitForSpinnerGone();
	await getPage()
		.locator(JobsProposalsPage.makeDefaultButtonCss)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// dispatchClick: a leftover toastr/dialog backdrop over the toolbar otherwise swallows the click and
	// the first confirmation (ConfirmComponent via the trash button's ngxConfirmDialog directive) never opens.
	await waitForSpinnerGone();
	await dispatchClick(JobsProposalsPage.deleteButtonCss);
};

export const confirmFirstDialogVisible = async () => {
	// First of two delete dialogs: ConfirmComponent (ngx-confirm) opened by the trash ngxConfirmDialog.
	await verifyElementIsVisible(JobsProposalsPage.confirmFirstDialogButtonCss);
};

export const clickConfirmFirstDialogButton = async () => {
	// Click "Yes" (status="primary") on ConfirmComponent. Only this fires (confirm)="deleteProposalTemplate()",
	// which then opens the SECOND dialog (DeleteConfirmationComponent). dispatchClick so the dialog's own
	// fading cdk-overlay backdrop can't intercept the click.
	await waitForSpinnerGone();
	await dispatchClick(JobsProposalsPage.confirmFirstDialogButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(JobsProposalsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Second dialog: the DeleteConfirmation OK button (status="danger"); dispatch fires (click)=delete()
	// directly so the dialog closes with 'ok' and the row is actually removed even under a fading backdrop.
	await waitForSpinnerGone();
	await dispatchClick(JobsProposalsPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(JobsProposalsPage.toastrMessageCss);
};

export const verifyElementIsDeleted = async (text) => {
	await verifyTextNotExisting(JobsProposalsPage.verifyProposalCss, text);
};

export const verifyProposalExists = async (text) => {
	await verifyText(JobsProposalsPage.verifyProposalCss, text);
};
