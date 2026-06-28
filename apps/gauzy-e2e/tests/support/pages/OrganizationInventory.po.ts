import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickButtonByText,
	verifyText,
	verifyTextNotExisting,
	verifyElementNotExist,
	clickElementByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationInventoryPage } from '../../../src/support/Base/pageobjects/OrganizationInventoryPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addCategoryOrTypeButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addCategoryOrTypeButtonCss);
};

export const clickAddCategoryOrTypeButton = async (text) => {
	await clickButtonByText(text);
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addButtonCss);
};

export const clickAddButton = async () => {
	// onAdd()/onAddInventoryItem() open the mutation dialog / item form, but onAdd() early-returns while
	// `this.organization` is still null — it loads via a debounced (300ms) store subscription AFTER the
	// route settles, so a click fired the instant the button renders is a silent no-op (the dialog never
	// opens; the form's name input never appears). The earlier failure looked like a stale name/description
	// selector but was really this race. Settle (spinner + network + debounce window), dispatchClick to be
	// backdrop-proof, then poll for the form name input and re-dispatch if the dialog didn't open.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	const nameInput = getPage().locator(OrganizationInventoryPage.nameInputCss).first();
	for (let i = 0; i < 5; i++) {
		await dispatchClick(OrganizationInventoryPage.addButtonCss);
		if (await nameInput.isVisible().catch(() => false)) return;
		await getPage().waitForTimeout(1000);
		if (await nameInput.isVisible().catch(() => false)) return;
	}
};

export const languageDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.languageDropdownCss);
};

export const clickLanguageDropdown = async () => {
	// ng-select (appendTo="body") opens on MOUSEDOWN and is backdrop-blockable; a force coordinate
	// click can also close the surrounding form. Open via the keyboard: focus the inner input + ArrowDown.
	const input = getPage().locator(OrganizationInventoryPage.languageDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const productTypeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.productTypeDropdownCss);
};

export const clickProductTypeDropdown = async () => {
	// ng-select (appendTo="body") — open via keyboard, not a backdrop-blockable coordinate click.
	const input = getPage().locator(OrganizationInventoryPage.productTypeDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const productCategoryDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.productCategoryDropdownCss);
};

export const clickProductCategoryDropdown = async () => {
	// ng-select (appendTo="body") — open via keyboard, not a backdrop-blockable coordinate click.
	const input = getPage().locator(OrganizationInventoryPage.productCategoryDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const clickDropdownOption = async (text) => {
	// The spec passes the option TEXT (e.g. 'English', 'CRM System', 'Web Development'), not an index —
	// the old clickButtonByIndex(.nth(text)) was a no-op/NaN. Typeahead-filter the currently-open
	// ng-select (only one open at a time; appendTo="body") to the target, then click the body-level
	// option. Options render as div.ng-option.
	const openInput = getPage().locator('ng-select.ng-select-opened input').first();
	await openInput.pressSequentially(String(text)).catch(() => {});
	// Prefer the EXACT-text option so a "[addTag] Add item: <text>" option (which also *contains* the
	// term, on the type/category selectors) can't be clicked instead of the existing record. Fall back
	// to a substring match if no exact option is rendered.
	const exact = getPage()
		.locator(OrganizationInventoryPage.dropdownOptionCss)
		.filter({ hasText: new RegExp(`^\\s*${String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) })
		.first();
	if (await exact.count()) {
		await exact.click({ force: true });
	} else {
		await clickElementByText(OrganizationInventoryPage.dropdownOptionCss, text);
	}
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(OrganizationInventoryPage.nameInputCss);
	await enterInput(OrganizationInventoryPage.nameInputCss, data);
};

export const codeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.codeInputCss);
};

export const enterCodeInputData = async (data) => {
	await clearField(OrganizationInventoryPage.codeInputCss);
	await enterInput(OrganizationInventoryPage.codeInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(OrganizationInventoryPage.descriptionInputCss);
	await enterInput(OrganizationInventoryPage.descriptionInputCss, data);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.backButtonCss);
};

export const clickBackButton = async () => {
	// Comes right after a save/dialog-close; dispatch so a fading backdrop can't intercept it.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationInventoryPage.backButtonCss);
};

export const backFromCategoryButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.backFromCategoryButtonCss);
};

export const clickBackFromCategoryButton = async () => {
	await clickButton(OrganizationInventoryPage.backFromCategoryButtonCss);
};

export const backFromInventoryButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.backFromInventoryButtonCss);
};

export const clickBackFromInventoryButton = async () => {
	// Comes right after saving the inventory item; dispatch so a fading backdrop can't intercept it.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationInventoryPage.backFromInventoryButtonCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Save sits in the card/dialog footer right after form input + (for inventory items) ng-select
	// mutations. A fading ng-select/dialog backdrop can intercept a coordinate click — dispatch the
	// event straight to the button so its (click) handler fires regardless.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationInventoryPage.saveButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.editButtonCss);
};

export const clickEditButton = async () => {
	// Clicked right after row selection; dispatch so a fading backdrop can't intercept the toolbar click.
	await dispatchClick(OrganizationInventoryPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// Clicked right after row selection; dispatch so a fading backdrop can't intercept the toolbar click.
	await dispatchClick(OrganizationInventoryPage.deleteButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	// The data-row click TOGGLES selection and enables the toolbar Edit/Delete buttons. Settle the grid
	// first (spinner + network + paint), then click ONCE and poll the Edit button's real `disabled`
	// attribute; only re-click if the selection didn't take. Rapid re-clicks just toggle it back off.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	const row = getPage().locator(OrganizationInventoryPage.selectTableRowCss).nth(index);
	const editBtn = getPage().locator(OrganizationInventoryPage.editButtonCss).first();
	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await editBtn.getAttribute('disabled').catch(() => null);
		if (disabled === null) return; // enabled -> a row is selected
		await getPage().waitForTimeout(500);
		const stillDisabled = await editBtn.getAttribute('disabled').catch(() => null);
		if (stillDisabled === null) return;
		await row.click({ force: true });
	}
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// OK button in the delete-confirmation dialog; dispatch to be backdrop-proof.
	await dispatchClick(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationInventoryPage.toastrMessageCss);
};

export const verifyTypeExists = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyTypeIsDeleted = async (text) => {
	await verifyTextNotExisting(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyCategoryExists = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyCategoryCss, text);
};

export const verifyCategoryIsDeleted = async (text) => {
	await verifyTextNotExisting(OrganizationInventoryPage.verifyCategoryCss, text);
};

export const verifyInventoryExists = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyInventoryCss, text);
};

export const verifyInventoryIsDeleted = async () => {
	await verifyElementNotExist(OrganizationInventoryPage.verifyInventoryCss);
};

export const merchantOrWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantsOrWarehousesBtnCss);
};

export const clickMerchantOrWarehouseBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.merchantsOrWarehousesBtnCss, text);
};

export const addMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addMerchantBtnCss);
};

export const clickAddMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.addMerchantBtnCss);
};

export const merchantNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantNameInputCss);
};

export const enterMerchantNameInput = async (name) => {
	await clearField(OrganizationInventoryPage.merchantNameInputCss);
	await enterInput(OrganizationInventoryPage.merchantNameInputCss, name);
};

export const merchantCodeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantCodeInputCss);
};

export const enterMerchantCode = async (code) => {
	await clearField(OrganizationInventoryPage.merchantCodeInputCss);
	await enterInput(OrganizationInventoryPage.merchantCodeInputCss, code);
};

export const merchantEmailInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantEmailInputCss);
};

export const enterMerchantEmail = async (email) => {
	await clearField(OrganizationInventoryPage.merchantEmailInputCss);
	await enterInput(OrganizationInventoryPage.merchantEmailInputCss, email);
};

export const merchantPhoneInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantPhoneInputCss);
};

export const enterMerchantPhone = async (phone) => {
	await clearField(OrganizationInventoryPage.merchantPhoneInputCss);
	await enterInput(OrganizationInventoryPage.merchantPhoneInputCss, phone);
};

export const merchantCurrencySelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantCurrencySelectCss);
};

export const clickMerchantCurrencySelect = async () => {
	await clickButton(OrganizationInventoryPage.merchantCurrencySelectCss);
};

export const currencyDropdownOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.dropdownOptionCss);
};

export const selectCurrencyFromDropdownOptions = async (currency) => {
	await clickElementByText(OrganizationInventoryPage.dropdownOptionCss, currency);
};

export const merchantWebsiteInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantWebsiteInputCss);
};

export const enterMerchantWebsite = async (website) => {
	await clearField(OrganizationInventoryPage.merchantWebsiteInputCss);
	await enterInput(OrganizationInventoryPage.merchantWebsiteInputCss, website);
};

export const tagsSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.tagsSelectCss);
};

export const clickTagsSelect = async () => {
	await clickButton(OrganizationInventoryPage.tagsSelectCss);
};

export const selectTagFromDropdownOptions = async (index) => {
	await clickButtonByIndex(OrganizationInventoryPage.tagsDropdownOptionCss, index);
};

export const merchantDescriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantDescriptionInputCss);
};

export const enterMerchantDescription = async (description) => {
	await clearField(OrganizationInventoryPage.merchantDescriptionInputCss);
	await enterInput(OrganizationInventoryPage.merchantDescriptionInputCss, description);
};

export const activeStateCheckBoxVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantActiveCheckboxCss);
};

export const clickActiveStateCheckbox = async () => {
	await clickButton(OrganizationInventoryPage.merchantActiveCheckboxCss);
};

export const merchantNextBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantNextBtnCss);
};

export const clickMerchantNextBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.merchantNextBtnCss, text);
};

export const countrySelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.countrySelectCss);
};

export const clickCountrySelect = async () => {
	await clickButton(OrganizationInventoryPage.countrySelectCss);
};

export const selectCountryFromDropdownOptions = async (country) => {
	await clickElementByText(OrganizationInventoryPage.dropdownOptionCss, country);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.cityInputCss);
};

export const enterCity = async (city) => {
	await clearField(OrganizationInventoryPage.cityInputCss);
	await enterInput(OrganizationInventoryPage.cityInputCss, city);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.postCodeInputCss);
};

export const enterPostcode = async (postcode) => {
	await clearField(OrganizationInventoryPage.postCodeInputCss);
	await enterInput(OrganizationInventoryPage.postCodeInputCss, postcode);
};

export const addressInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addressInputCss);
};

export const enterAddress = async (address) => {
	await clearField(OrganizationInventoryPage.addressInputCss);
	await enterInput(OrganizationInventoryPage.addressInputCss, address);
};

export const warehousesSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehousesSelectCss);
};

export const clickWarehousesSelect = async () => {
	await clickButton(OrganizationInventoryPage.warehousesSelectCss);
};

export const saveMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.saveMerchantBtnCss);
};

export const clickSaveMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.saveMerchantBtnCss);
};

export const editMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.editMerchantBtnCss);
};

export const clickEditMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.editMerchantBtnCss);
};

export const deleteMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.deleteMerchantBtnCss);
};

export const clickDeleteMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.deleteMerchantBtnCss);
};

export const addWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addWarehouseBtnCss);
};

export const clickAddWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.addWarehouseBtnCss);
};

export const warehouseNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseNameInputCss);
};

export const enterWarehouseName = async (name) => {
	await clearField(OrganizationInventoryPage.warehouseNameInputCss);
	await enterInput(OrganizationInventoryPage.warehouseNameInputCss, name);
};

export const warehouseCodeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseCodeInputCss);
};

export const enterWarehouseCode = async (code) => {
	await clearField(OrganizationInventoryPage.warehouseCodeInputCss);
	await enterInput(OrganizationInventoryPage.warehouseCodeInputCss, code);
};

export const warehouseEmailInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseEmailInputCss);
};

export const enterWarehouseEmail = async (email) => {
	await clearField(OrganizationInventoryPage.warehouseEmailInputCss);
	await enterInput(OrganizationInventoryPage.warehouseEmailInputCss, email);
};

export const warehouseDescriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseDescriptionInputCss);
};

export const enterWarehouseDescription = async (description) => {
	await clearField(OrganizationInventoryPage.warehouseDescriptionInputCss);
	await enterInput(OrganizationInventoryPage.warehouseDescriptionInputCss, description);
};

export const tabBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.tabBtnCss);
};

export const clickTabBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.tabBtnCss, text);
};

export const saveWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.saveWarehouseBtnCss);
};

export const clickSaveWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.saveWarehouseBtnCss);
};

export const editWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.editWarehouseBtnCss);
};

export const clickEditWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.editWarehouseBtnCss);
};

export const deleteWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.deleteWarehouseBtnCss);
};

export const clickDeleteWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.deleteWarehouseBtnCss);
};

export const sidebarBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.sidebarBtnCss);
};

export const clickSidebarBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.sidebarBtnCss, text);
};

export const verifyMerchantWarehouse = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyMerchantWarehouseCss, text);
};

export const clickInventorySidebarBtn = async () => {
	await clickButton(OrganizationInventoryPage.inventorySidebarBtnCss);
};
