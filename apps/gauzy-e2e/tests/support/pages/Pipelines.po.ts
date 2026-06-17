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
	verifyByLength
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
	// briefly re-rendered while the list refreshes). Retry until the dialog name field shows.
	for (let attempt = 0; attempt < 4; attempt++) {
		await getPage().locator(PipelinesPage.addPipelineButtonCss).first().click({ force: true }).catch(() => undefined);
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
	await clickButton(PipelinesPage.createPipelineButtonCss);
};

export const tableRowVisible = async () => {
	await expect(getPage().locator(PipelinesPage.selectTableRowCss).first()).toBeVisible({ timeout: 24000 });
};

export const selectTableRow = async (index: number) => {
	await clickButtonByIndex(PipelinesPage.selectTableRowCss, index);
};

export const editPipelineButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.editPipelineButtonCss);
};

export const clickEditPipelineButton = async () => {
	// Edit is enabled only with a selected row, and the dialog can fail to open on the
	// first click. Re-select the first row and retry until the dialog name field shows.
	for (let attempt = 0; attempt < 4; attempt++) {
		await getPage().locator(PipelinesPage.selectTableRowCss).first().click({ force: true }).catch(() => undefined);
		await getPage().waitForTimeout(500);
		await getPage().locator(PipelinesPage.editPipelineButtonCss).first().click({ force: true }).catch(() => undefined);
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
	await clickButton(PipelinesPage.updateButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.deletePipelineButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(PipelinesPage.deletePipelineButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(PipelinesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(PipelinesPage.confirmDeleteButtonCss);
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
