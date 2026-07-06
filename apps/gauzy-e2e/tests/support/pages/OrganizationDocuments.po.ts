import {
	verifyElementIsVisible,
	clearField,
	enterInput,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationDocumentsPage } from '../../../src/support/Base/pageobjects/OrganizationDocumentsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.addButtonCss);
};

export const clickAddButton = async () => {
	// The documents card shows a full-card [nbSpinner] while _loadDocuments() runs after navigation;
	// a coordinate force-click lands on that spinner overlay and the add dialog never opens (the
	// original failure: #documentName never appeared). Settle the spinner, then dispatch the click
	// straight to the button so the (click)="openDialog(...)" handler fires regardless of any overlay.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationDocumentsPage.addButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationDocumentsPage.nameInputCss);
	await enterInput(OrganizationDocumentsPage.nameInputCss, data);
};

export const urlInputVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.urlInputCss);
};

export const enterUrlInputData = async (data: string) => {
	await enterInput(OrganizationDocumentsPage.urlInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// dispatchClick: Save lives in the open nb-dialog; a coordinate click can be intercepted by the
	// dialog's cdk-overlay backdrop, so fire the (click)="submitForm()" handler directly.
	await dispatchClick(OrganizationDocumentsPage.saveButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	// dispatchClick: opens the edit dialog (Edit was enabled by selectDocumentRow()); bypass any
	// fading backdrop left by the previous create dialog.
	await dispatchClick(OrganizationDocumentsPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.deleteButtonCss);
};

export const clickDeleteButton = async (index: number) => {
	// dispatchClick: opens the delete-confirmation dialog (Delete enabled by selectDocumentRow()).
	await dispatchClick(OrganizationDocumentsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// dispatchClick: confirm button is in the just-opened delete dialog; its backdrop intercepts a
	// coordinate click, so dispatch straight to the (click)="delete()" handler.
	await dispatchClick(OrganizationDocumentsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	// Commit the URL: the file-uploader input only populates the form's docUrl on its (change) handler
	// (inputUrlChanged -> uploadedImgUrl -> docUrl.setValue), and submitForm() reads docUrl. A click
	// on nb-card-body lands on the dialog backdrop (the page card sits behind it), so instead dispatch
	// change + blur straight onto the URL input to fire that handler reliably.
	await getPage()
		.locator(OrganizationDocumentsPage.urlInputCss)
		.first()
		.evaluate((el: HTMLInputElement) => {
			el.dispatchEvent(new Event('change', { bubbles: true }));
			el.blur();
		});
};

// Select the document row matching `name` so the toolbar Edit/Delete buttons become enabled. The
// buttons are always in the DOM but render [disabled]="true" until selectDocument() runs (root cause
// #4: the row click TOGGLES selection). Settle the grid first, click the row once, then poll Edit's
// real `disabled` attribute; only re-click if selection was lost — never rapid re-click. Targeting by
// name (not index) avoids selecting a leftover polluting row.
export const selectDocumentRow = async (name: string) => {
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);

	const row = getPage()
		.locator(OrganizationDocumentsPage.selectTableRowCss)
		.filter({ hasText: name })
		.first();
	await row.waitFor({ state: 'visible', timeout: 24_000 });

	const editBtn = getPage().locator(OrganizationDocumentsPage.editButtonCss).first();
	await row.click({ force: true });

	for (let i = 0; i < 5; i++) {
		const disabled = await editBtn.getAttribute('disabled');
		if (disabled === null) return; // Edit enabled => row is selected
		await getPage().waitForTimeout(500);
		// selection may have toggled off; re-select once per iteration
		if ((await editBtn.getAttribute('disabled')) !== null) {
			await row.click({ force: true });
		}
	}
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationDocumentsPage.toastrMessageCss);
};

export const verifyDocumentExists = async (text: string) => {
	await verifyText(OrganizationDocumentsPage.verifyDocumentCss, text);
};

export const verifyDocumentIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationDocumentsPage.verifyDocumentCss, text);
};
