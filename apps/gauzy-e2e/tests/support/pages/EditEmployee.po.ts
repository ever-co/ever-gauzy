import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	verifyValue,
	waitElementToHide,
	waitForSpinnerGone,
	dispatchClick,
	dispatchClickWhenSettled,
	verifyText
} from '../util';
import { getPage } from '../page-context';
import { selectNgOption } from '../ng-select';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EditEmployeePage } from '../../../src/support/Base/pageobjects/EditEmployeePageObject';

export const selectEmployeeByName = async (name: string) => {
	// The accounting dashboard lists working employees as breakdown rows whose (click) selects the
	// employee and opens the HR dashboard. The row also holds an <ngx-avatar> whose NAME LINK has its own
	// (click)="edit(id)" straight to the edit form — a coordinate click on the row's text would land on
	// that link and skip the HR dashboard this flow goes through. Dispatch the click on the row element
	// itself so only the row's selectEmployee() fires. The rows render after the aggregate statistics
	// request resolves, so wait for ours first.
	const row = getPage().locator(EditEmployeePage.employeeCss).filter({ hasText: name }).first();
	await row.waitFor({ state: 'visible', timeout: 60_000 });
	await row.dispatchEvent('click');
	await getPage()
		.waitForFunction(() => location.hash.split('?')[0].endsWith('/pages/dashboard/hr'), undefined, {
			timeout: 30_000
		})
		.catch(() => undefined);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.editButtonCss);
};

export const clickEditButton = async () => {
	// The trigger is an nb-icon inside the HR dashboard header, which sits in an `[nbSpinner]` card and
	// reflows as the permissions alert / salary / bonus blocks resolve. `clickButton`'s force:true skips
	// the actionability CHECK but still delivers the click at screen COORDINATES, so it could land on
	// the spinner overlay or on a position the header had already moved out from under — an
	// intermittent no-op that left the run sitting on the dashboard (observed as a flaky
	// "#usernameInput not found"). Settle first, dispatch straight at the element so no overlay can
	// intercept, and confirm on the edit form's own field.
	await dispatchClickWhenSettled(EditEmployeePage.editButtonCss, EditEmployeePage.usernameInputCss);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.usernameInputCss);
};

export const enterUsernameInputData = async (data: string) => {
	await clearField(EditEmployeePage.usernameInputCss);
	await enterInput(EditEmployeePage.usernameInputCss, data);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.firstNameInputCss);
};

export const enterFirstNameData = async (data: string) => {
	await clearField(EditEmployeePage.firstNameInputCss);
	await enterInput(EditEmployeePage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.lastNameInputCss);
};

export const enterLastNameData = async (data: string) => {
	await clearField(EditEmployeePage.lastNameInputCss);
	await enterInput(EditEmployeePage.lastNameInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await clearField(EditEmployeePage.emailInputCss);
	await enterInput(EditEmployeePage.emailInputCss, data);
};

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.preferredLanguageCss);
};

export const chooseLanguage = async (data: string) => {
	await clickButton(EditEmployeePage.preferredLanguageCss);
	await clickElementByText(EditEmployeePage.dropdownOptionCss, data);
};

export const tabButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.tabButtonCss);
};

export const clickTabButton = async (tab: number | string) => {
	// Route-tabs are <li.route-tab> wrapping an <a.tab-link routerLink>; the navigation lives on the
	// inner anchor. A coordinate click on the <li> (clickButtonByIndex) can land on a fading
	// cdk-overlay backdrop left by the just-closed datepicker / nb-select / ng-select on the previous
	// tab, so the hash route never changes and the next tab's lazy component never renders (round-4:
	// the Location tab stayed on Hiring after the date pickers closed). Settle any transient spinner,
	// then dispatch the click straight to the nth anchor so routerLink fires regardless of any overlay.
	//
	// A string addresses the tab by its route id (account, networks, employment, hiring, location, rates,
	// projects, contacts, ...): the tabs are registered through PageTabRegistryService
	// (edit-employee-profile.component.ts) and rendered by gz-dynamic-tabs as an nb-route-tabset whose
	// anchors carry `href="#/pages/employees/edit/<id>/<tab>"`, so the id survives a tab being added,
	// hidden or reordered — an index does not. The route change is then confirmed on location.hash.
	await waitForSpinnerGone();
	const page = getPage();
	const anchor =
		typeof tab === 'string'
			? page.locator(`${EditEmployeePage.tabButtonCss} a.tab-link[href$="/${tab}"]`).first()
			: page.locator(`${EditEmployeePage.tabButtonCss} a.tab-link`).nth(tab);
	if (typeof tab !== 'string') {
		await anchor.dispatchEvent('click');
		// Let the hash route swap + the destination tab component begin rendering before the caller's
		// *Visible() poll (each tab is a separate lazy route component).
		await page.waitForTimeout(800);
		return;
	}
	const onTab = () =>
		page
			.waitForFunction((id) => location.hash.split('?')[0].endsWith(`/${id}`), tab, { timeout: 8000 })
			.then(() => true)
			.catch(() => false);
	for (let attempt = 0; attempt < 2; attempt++) {
		await anchor.dispatchEvent('click');
		if (await onTab()) break;
		await waitForSpinnerGone();
	}
	await page.waitForTimeout(800);
};

export const linkedinInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.linkedInInputCss);
};

export const enterLinkedinInputData = async (data: string) => {
	await clearField(EditEmployeePage.linkedInInputCss);
	await enterInput(EditEmployeePage.linkedInInputCss, data);
};

export const githubInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.githubInputCss);
};

export const enterGithubInputData = async (data: string) => {
	await clearField(EditEmployeePage.githubInputCss);
	await enterInput(EditEmployeePage.githubInputCss, data);
};

export const upworkInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.upworkInputCss);
};

export const enterUpworkInputData = async (data: string) => {
	await clearField(EditEmployeePage.upworkInputCss);
	await enterInput(EditEmployeePage.upworkInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data: string) => {
	await clearField(EditEmployeePage.descriptionInputCss);
	await enterInput(EditEmployeePage.descriptionInputCss, data);
};

export const offerDateInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.offerDateInputCss);
};

export const enterOfferDateData = async () => {
	await clearField(EditEmployeePage.offerDateInputCss);
	const date = dayjs().add(1, 'd').format('MMM D, YYYY');
	await enterInput(EditEmployeePage.offerDateInputCss, date);
};

export const acceptDateInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.acceptDateInputCss);
};

export const enterAcceptDateData = async () => {
	await clearField(EditEmployeePage.acceptDateInputCss);
	const date = dayjs().add(2, 'd').format('MMM D, YYYY');
	await enterInput(EditEmployeePage.acceptDateInputCss, date);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(EditEmployeePage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text: string) => {
	await clickElementByText(EditEmployeePage.dropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.cityInputCss);
};

export const enterCityInputData = async (data: string) => {
	await clearField(EditEmployeePage.cityInputCss);
	await enterInput(EditEmployeePage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data: string) => {
	await clearField(EditEmployeePage.postCodeInputCss);
	await enterInput(EditEmployeePage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.addressInputCss);
};

export const enterStreetInputData = async (data: string) => {
	await clearField(EditEmployeePage.addressInputCss);
	await enterInput(EditEmployeePage.addressInputCss, data);
};

export const payPeriodDropdownVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.payPeriodDropdownCss);
};

export const clickPayPeriodDropdown = async () => {
	await clickButton(EditEmployeePage.payPeriodDropdownCss);
};

export const selectPayPeriodOption = async (text: string) => {
	// Exact label: the pay periods render as "None", "Bi Weekly", "Weekly", ... (PayPeriodEnum order), so a
	// substring match on "Weekly" picked "Bi Weekly", the first option containing it.
	const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const exact = new RegExp(`^\\s*${escaped}\\s*$`);
	await getPage()
		.locator(EditEmployeePage.dropdownOptionCss)
		.filter({ hasText: exact })
		.first()
		.click({ force: true, timeout: 60_000 });
};

export const weeklyLimitInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.weeklyLimitInputCss);
};

export const enterWeeklyLimitInputData = async (data: string) => {
	await clearField(EditEmployeePage.weeklyLimitInputCss);
	await enterInput(EditEmployeePage.weeklyLimitInputCss, data);
};

export const billRateInputVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.billRateValueInputCss);
};

export const enterBillRateInputData = async (data: string) => {
	await clearField(EditEmployeePage.billRateValueInputCss);
	await enterInput(EditEmployeePage.billRateValueInputCss, data);
};

export const addProjectOrContactButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.addProjectOrContactButtonCss);
};

export const clickAddProjectOrContactButton = async () => {
	await clickButton(EditEmployeePage.addProjectOrContactButtonCss);
};

export const projectOrContactDropdownVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.projectOrContactsDropdownCss);
};

export const clickProjectOrContactDropdown = async () => {
	// no-op open: this is an ng-select (#departmentsSelect, appendTo="body") that opens on MOUSEDOWN.
	// A coordinate/force click only focuses the control (combobox goes [active]) but the cdk overlay
	// panel never renders, so its 'div.ng-option' options never appear (the round-2 timeout). The
	// keyboard open below (in selectProjectOrContactFromDropdown) drives the panel reliably, so this
	// wrapper is intentionally inert to avoid the focus-only click closing/no-opening the panel.
};

export const selectProjectOrContactFromDropdown = async (index: number) => {
	// #departmentsSelect is the <ga-edit-employee-membership> ng-select (multiple, hideSelected,
	// appendTo="body"). Driven through the shared ng-select driver: it opens the control by keyboard,
	// counts only REAL options (ng-select's "No items found" row is also a `div.ng-option`, which the old
	// loop happily "clicked" as if it were a project), and confirms the pick by the chip it commits.
	// BEST-EFFORT by design: the list is "all org entities MINUS the ones already assigned to this
	// employee", so on the Projects tab it is legitimately EMPTY when CustomCommands.addProject already
	// made this employee a member of every project. In that case nothing is picked, the add form's "Add"
	// stays disabled, and the caller's verifyProjectOrContactExist still checks the employee's list.
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await selectNgOption(
		EditEmployeePage.projectOrContactsDropdownCss,
		EditEmployeePage.projectOrContactDropdownOptionCss,
		index
	);
	// Close the body-appended panel (no dialog here, so Escape can't dismiss anything else) so it can't
	// sit over the add form's buttons.
	await page.keyboard.press('Escape').catch(() => {});
};

export const saveProjectOrContactButtonVisible = async () => {
	await verifyElementIsVisible(EditEmployeePage.saveProjectOrContactButtonCss);
};

export const clickSaveProjectOrContactButton = async () => {
	// dispatchClick: the just-closed ng-select panel leaves a fading cdk overlay over this footer "Add"
	// button, so a coordinate click lands on the overlay. Dispatch fires submitForm() directly (the
	// button only gates on form.invalid, which is satisfied once an option is picked).
	await waitForSpinnerGone();
	await dispatchClick(EditEmployeePage.saveProjectOrContactButtonCss);
};

export const verifyProjectOrContactExist = async () => {
	await verifyElementIsVisible(EditEmployeePage.verifyProjectOrContactCss);
};

export const saveBtnExists = async () => {
	await verifyElementIsVisible(EditEmployeePage.saveButtonCss);
};

export const saveBtnClick = async () => {
	// Dispatched: the success toasts of the Projects/Contacts adds just before can still be on screen,
	// and a coordinate click must not land on one. The button is enabled (the account form is valid).
	await waitForSpinnerGone();
	await dispatchClick(EditEmployeePage.saveButtonCss);
};

export const verifyEmployee = async (text: string) => {
	await verifyText(EditEmployeePage.verifyEmployeeCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EditEmployeePage.toastrMessageCss);
};

//////////////////////////////////////////////////////////////////////////////
export const verifyFirstName = async (val: string) => {
	await verifyValue(EditEmployeePage.firstNameInputCss, val);
};

export const verifyLastName = async (val: string) => {
	await verifyValue(EditEmployeePage.lastNameInputCss, val);
};

export const verifyEmail = async (val: string) => {
	await verifyValue(EditEmployeePage.emailInputCss, val);
};
