import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyTextNotExisting,
	verifyText,
	enterInputByIndex,
	verifyElementIsVisibleByIndex,
	clearFieldByIndex,
	verifyByLength,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
import { expect } from '@playwright/test';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { PipelinesPage } from '../../../src/support/Base/pageobjects/PipelinesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addPipelineButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.addPipelineButtonCss);
};

export const clickAddPipelineButton = async () => {
	// The create dialog occasionally fails to open on the first click (the button can be
	// briefly re-rendered while the list refreshes). Settle the page, then dispatchClick (fires the
	// (click)=createPipeline() handler even under the page-load spinner) and retry until the name field shows.
	await waitForSpinnerGone();
	for (let attempt = 0; attempt < 4; attempt++) {
		await dispatchClick(PipelinesPage.addPipelineButtonCss).catch(() => undefined);
		try {
			await getPage().locator(PipelinesPage.pipelineNameInputCss).first().waitFor({ state: 'visible', timeout: 8000 });
			return;
		} catch {
			await getPage().waitForTimeout(800);
		}
	}
	await getPage().locator(PipelinesPage.pipelineNameInputCss).first().waitFor({ state: 'visible', timeout: 16000 });
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.pipelineNameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(PipelinesPage.pipelineNameInputCss);
	await enterInput(PipelinesPage.pipelineNameInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data: string) => {
	await clearField(PipelinesPage.descriptionInputCss);
	await enterInput(PipelinesPage.descriptionInputCss, data);
};

export const createPipelineButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.createPipelineButtonCss);
};

export const clickCreatePipelineButton = async () => {
	// Submit inside the open create dialog. Use dispatchClick so the (ngSubmit) handler fires even if a
	// previous fading cdk-overlay backdrop still sits over the footer.
	await dispatchClick(PipelinesPage.createPipelineButtonCss);
};

export const tableRowVisible = async () => {
	await expect(getPage().locator(PipelinesPage.selectTableRowCss).first()).toBeVisible({ timeout: 24000 });
};

export const selectTableRow = async (index: number) => {
	// Row click TOGGLES selection, which enables the toolbar Edit/Delete buttons. Settle the grid first
	// (post-mutation refresh + spinner) so the click lands on a stable row and isn't immediately undone
	// by a re-render, then click ONCE. Re-selection (if the toggle is lost) is handled by the consumers
	// (clickEditPipelineButton / clickDeleteButton) which poll the button's real `disabled` attr.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	await getPage().locator(PipelinesPage.selectTableRowCss).nth(index).click({ force: true });
};

export const editPipelineButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.editPipelineButtonCss);
};

export const clickEditPipelineButton = async () => {
	// Edit is enabled only with a selected row (`[disabled]="!selectedItem && disableButton"`). The row
	// click TOGGLES selection, so we must NOT rapid re-click — that would deselect and re-disable Edit.
	// Instead: ensure the row is selected by polling the Edit button's real `disabled` attr, only
	// re-clicking the row when selection was actually lost, then dispatchClick the Edit button (the
	// create dialog just closed → a fading backdrop can intercept a coordinate click).
	const editBtn = getPage().locator(PipelinesPage.editPipelineButtonCss).first();
	const row = getPage().locator(PipelinesPage.selectTableRowCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		// Make sure a row is selected (Edit enabled) before opening the dialog.
		if ((await editBtn.getAttribute('disabled')) !== null) {
			await row.click({ force: true }).catch(() => undefined);
			await getPage().waitForTimeout(600);
		}
		await dispatchClick(PipelinesPage.editPipelineButtonCss).catch(() => undefined);
		try {
			await getPage().locator(PipelinesPage.pipelineNameInputCss).first().waitFor({ state: 'visible', timeout: 8000 });
			return;
		} catch {
			await getPage().waitForTimeout(800);
		}
	}
	await getPage().locator(PipelinesPage.pipelineNameInputCss).first().waitFor({ state: 'visible', timeout: 16000 });
};

export const updateButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.updateButtonCss);
};

export const clickUpdateButton = async () => {
	// Submit inside the open edit dialog; dispatchClick so (ngSubmit) fires regardless of any overlay.
	await dispatchClick(PipelinesPage.updateButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.deletePipelineButtonCss);
};

export const clickDeleteButton = async () => {
	// Delete is enabled only with a selected row. Ensure selection by polling the button's real
	// `disabled` attr (re-selecting only if the toggle was lost — never rapid re-click), then
	// dispatchClick to open the confirm dialog (avoids any leaked backdrop intercepting the click).
	const deleteBtn = getPage().locator(PipelinesPage.deletePipelineButtonCss).first();
	const row = getPage().locator(PipelinesPage.selectTableRowCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		if ((await deleteBtn.getAttribute('disabled')) !== null) {
			await row.click({ force: true }).catch(() => undefined);
			await getPage().waitForTimeout(600);
		} else {
			break;
		}
	}
	await dispatchClick(PipelinesPage.deletePipelineButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Confirm (OK) inside the delete dialog; dispatchClick so the (click)=delete() handler fires even if
	// the dialog backdrop is mid-animation.
	await dispatchClick(PipelinesPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(PipelinesPage.toastrMessageCss);
};

export const verifyPipelineIsDeleted = async (text: string) => {
	await expect(
		getPage().locator(PipelinesPage.selectTableRowCss).filter({ hasText: text })
	).toHaveCount(0, { timeout: 24000 });
};

export const verifyPipelineExists = async (text: string) => {
	await expect(
		getPage().locator(PipelinesPage.selectTableRowCss).filter({ hasText: text }).first()
	).toBeVisible({ timeout: 24000 });
};

export const enterNameInputDataByIndex = async (data: string, index: number) => {
	await clearFieldByIndex(PipelinesPage.pipelineNameInputCss, index);
	await enterInputByIndex(PipelinesPage.pipelineNameInputCss, data, index);
};

export const verifyStageButton = async () => {
	await verifyElementIsVisible(PipelinesPage.stageButtonCss);
};

export const clickOnStageButton = async () => {
	await clickButton(PipelinesPage.stageButtonCss);
};

export const verifyStageNameInput = async (index: number) => {
	await verifyElementIsVisibleByIndex(PipelinesPage.pipelineNameInputCss, index);
};

export const enterDescriptionInputDataByIndex = async (data: string, index: number) => {
	await clearFieldByIndex(PipelinesPage.descriptionInputCss, index);
	await enterInputByIndex(PipelinesPage.descriptionInputCss, data, index);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(PipelinesPage.selectTableRowCss, length);
};

export const verifyNamePlaceholder = async () => {
	await verifyElementIsVisible(PipelinesPage.namePlaceholderCss);
};

export const enterNamePlaceholder = async (name: string) => {
	await clearField(PipelinesPage.namePlaceholderCss);
	const waitResult = getPage().waitForResponse((res) => res.url().includes('/api/pipelines/pagination'));
	await enterInput(PipelinesPage.namePlaceholderCss, name);
	await waitResult;
};

export const verifyDetailsButton = async () => {
	await verifyElementIsVisible(PipelinesPage.detailsButtonCss);
};

export const clickViewDetailsButton = async () => {
	const waitPipelines = getPage().waitForResponse((res) => res.url().includes('/api/pipelines'));
	await clickButton(PipelinesPage.detailsButtonCss);
	await waitPipelines;
};

export const verifyTitleInput = async () => {
	await verifyElementIsVisible(PipelinesPage.titleInputCss);
};

export const enterTitleInput = async (data: string) => {
	await enterInput(PipelinesPage.titleInputCss, data);
};

export const verifyCreateButton = async () => {
	await verifyElementIsVisible(PipelinesPage.createDealButtonCss);
};

export const clickOnCreateDealButton = async () => {
	await clickButton(PipelinesPage.createDealButtonCss);
};

export const verifyAddDealButton = async () => {
	await verifyElementIsVisible(PipelinesPage.addDealPipelineButtonCss);
};

export const clickAddDealButton = async () => {
	await clickButton(PipelinesPage.addDealPipelineButtonCss);
};

export const verifyProbabilityInput = async () => {
	await verifyElementIsVisible(PipelinesPage.probabilityInputCss);
};

export const clickOnProbabilityInput = async () => {
	await clickButton(PipelinesPage.probabilityInputCss);
};

export const clickDropdownOption = async (index: number) => {
	await clickButtonByIndex(PipelinesPage.dropdownOptionCss, index);
};

export const verifyBackButton = async () => {
	await verifyElementIsVisible(PipelinesPage.backButtonCss);
};

export const clickOnBackButton = async () => {
	await clickButton(PipelinesPage.backButtonCss);
};
