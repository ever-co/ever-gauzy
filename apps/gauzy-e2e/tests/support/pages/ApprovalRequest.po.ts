import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	clickButtonWithForce,
	clickByText,
	verifyTextByIndex,
	verifyTextNotExistByIndex,
	verifyByText,
	verifyByLength,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ApprovalRequestPage } from '../../../src/support/Base/pageobjects/ApprovalRequestPageObject';

// Robust hash-router navigation used by BOTH gotoApprovals and gotoApprovalPolicy.
//
// ROUND-6 root cause (confirmed by the failure screenshot: the app was still on "Manage Employees" —
// #/pages/employees — while the add-request verify ran): the app is a useHash:true SPA, and EVERY same-
// document hash navigation here (page.goto() to a fragment-only-different URL, AND a plain
// `location.hash = target`) can be a NO-OP that never re-renders the Angular router. The approvals route
// (#/pages/employees/approvals) shares its path+origin with the addEmployee prerequisite's landing route
// (#/pages/employees), so goto() sets location.hash to the target WITHOUT firing a route change, then the
// old `if (hash !== target) location.hash = target` guard sees the hash already correct and does nothing —
// the app stays wedged on Manage Employees. The dashboard-bounce fallback was also same-document, so it
// could wedge the same way.
//
// Fix: (1) ALWAYS bounce through #/pages/dashboard first so the assignment to the target hash is a genuine
// change that fires `hashchange`; (2) if the target screen's header still hasn't mounted, escape the SPA
// no-op entirely with a HARD page.reload() of the target hash URL — a full document load re-bootstraps
// Angular directly onto the target route and CANNOT be a same-document no-op. `header` is the card's h4
// text ("Approval Request" / "Approval Policy" — distinct from the employees grid's "Manage Employees").
const gotoHashRoute = async (targetHash: string, header: string): Promise<void> => {
	const page = getPage();
	const headerLoc = page.locator(`h4:has-text("${header}")`).first();
	// Unconditional dashboard bounce so the following target-hash assignment is always a REAL hashchange.
	await page.evaluate(() => {
		location.hash = '#/pages/dashboard';
	});
	await page.waitForTimeout(300);
	await page.evaluate((h) => {
		location.hash = h;
	}, targetHash);
	try {
		await headerLoc.waitFor({ state: 'visible', timeout: 12000 });
	} catch {
		// SPA hash nav wedged. location.hash is already the target (the assignment above updated the URL
		// bar even when Angular didn't re-render), so a HARD page.reload() re-bootstraps the app directly
		// onto the target hash route — a full document load that CANNOT be a same-document no-op. Re-force
		// the hash first in case the target assignment itself was swallowed, then reload.
		await page.evaluate((h) => {
			if (location.hash.split('?')[0] !== h) location.hash = h;
		}, targetHash);
		await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
		await headerLoc.waitFor({ state: 'visible', timeout: 20000 }).catch(() => undefined);
	}
	await waitForSpinnerGone();
	await page.waitForTimeout(500);
};

export const gotoApprovals = async () => {
	await gotoHashRoute('#/pages/employees/approvals', 'Approval Request');
};

export const gotoApprovalPolicy = async () => {
	await gotoHashRoute('#/pages/organization/approval-policy', 'Approval Policy');
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addApprovalButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickAddApprovalButton = async () => {
	// Add ((click)="add()"/save(true)) opens the policy/request mutation dialog. It is reached right after
	// the addTag + addEmployee dialog flows (and a router navigation to the policy page), whose fading
	// cdk-overlay backdrops sit over the toolbar — a coordinate click (even force) lands on the backdrop,
	// so the dialog never opens and the next nameInput assertion times out. Wait out any load spinner, then
	// dispatch the click straight to the button so add()/save() fires regardless of the overlay.
	await waitForSpinnerGone();
	await dispatchClick(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(ApprovalRequestPage.nameInputCss);
	await enterInput(ApprovalRequestPage.nameInputCss, data);
};

export const minCountInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.minCountInputCss);
};

export const enterMinCountInputData = async (data) => {
	await enterInput(ApprovalRequestPage.minCountInputCss, data);
};

export const approvalPolicyDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const clickApprovalPolicyDropdown = async () => {
	await clickButton(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const selectApprovalPolicyOptionDropdown = async (text) => {
	await clickElementByText(ApprovalRequestPage.checkApprovalPolicyDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	// Wait out any full-card spinner (it overlays the select and swallows the open click), then open the
	// employee multi-select. Its options are the org's employees "working" in the header date range, loaded
	// async — selectEmployeeFromDropdown handles an empty/slow list best-effort.
	await waitForSpinnerGone();
	await clickButton(ApprovalRequestPage.usersMultiSelectCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	// Best-effort employee pick (mirrors ContactsLeads.selectEmployeeDropdownOption): the option list loads
	// async and can legitimately be empty (no employee "working" in the selected date range). Click one if
	// it shows within ~8s; otherwise press Escape and continue — the request saves fine without members, so
	// the next Save still proceeds. Avoids the hard 60s timeout on an empty list that hung this step.
	const page = getPage();
	const option = page.locator(ApprovalRequestPage.checkUsersMultiSelectCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => undefined);
	}
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Save (footer status="success") submits the mutation form. It is clicked right after the policy
	// nb-select and employee multi-select overlays close, which leave a fading cdk-overlay backdrop over
	// the dialog footer — a coordinate click lands on that backdrop and the save never fires. Wait out any
	// spinner, then dispatch the click straight to the button. The button is only enabled once the form is
	// valid (name + min_count + policy filled), so dispatch fires onSubmit() exactly as a real click would.
	await waitForSpinnerGone();
	await dispatchClick(ApprovalRequestPage.saveButtonCss);
};

export const selectTableRowVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.selectTableRowCss);
};

// Type a request's unique name into the grid's Name-column filter so the grid shows ONLY that record. The
// approvals grid is shared+serial and uses a client-side LocalDataSource with pagination, so an unfiltered
// "row 0" is whatever the accumulated rows from earlier specs/runs put first — NOT necessarily our request.
// Filtering by the unique faker name makes the subsequent row-0 selection / verify-exists order-independent.
export const searchRequestByName = async (name) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	const filter = page.locator(ApprovalRequestPage.nameFilterInputCss).first();
	await filter.fill(String(name)).catch(() => undefined);
	// smart-table filtering is debounced; let the grid re-render down to the single match before selecting.
	await page.waitForTimeout(1500);
	await waitForSpinnerGone();
};

export const selectTableRow = async (name) => {
	// Both callers (edit + delete steps) open with this helper. A queued history.back() from an earlier
	// navigation can pop us onto Manage Employees AFTER the add-request step already passed on approvals
	// (confirmed by an earlier dump: the edit verify ran while the DOM was the employees grid). Re-assert
	// we're on the approvals screen first — gotoApprovals waits for the "Approval Request" header so we
	// never select a row on the wrong grid; the request rows persist server-side, so the freshly reloaded
	// grid still contains our record.
	await gotoApprovals();
	// POLLUTION RESILIENCE: filter the grid to OUR uniquely-named request, then select by that name. The
	// caller now passes the unique faker request name (not an index) so we never grab a leftover row from
	// another spec/run. The filtered grid renders our record as the only data row.
	await searchRequestByName(name);
	// Row click TOGGLES selection and enables the toolbar Edit/Delete buttons. Settle the grid first, then
	// click the matching row ONCE and poll the Edit button's real `disabled` attr; only re-click if
	// selection was lost. A rapid re-click would toggle the row back off and leave the toolbar disabled
	// (force-clicking a disabled Edit button is a no-op, so the next dialog never opens).
	const page = getPage();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(1500);
	// Scope the row to the unique name as a belt-and-braces over the filter (filter could fail to apply if
	// the column class shifts): hasText still pins us to our record even on an unfiltered grid.
	const row = page.locator(ApprovalRequestPage.selectTableRowCss).filter({ hasText: name }).first();
	const editBtn = page.locator(ApprovalRequestPage.editApprovalRequestButtonCss).first();
	await row.click({ force: true, timeout: 60_000 });
	for (let i = 0; i < 10; i++) {
		const disabled = await editBtn.getAttribute('disabled');
		if (disabled === null) return; // selection took: Edit is enabled
		await page.waitForTimeout(500);
		if (i === 4) await row.click({ force: true, timeout: 60_000 }); // re-click once mid-poll if still disabled
	}
};

export const editApprovalRequestButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.editApprovalRequestButtonCss);
};

export const clickEditApprovalRequestButton = async () => {
	// Edit (toolbar button.action.primary -> save(false, item)) opens the request mutation dialog. It is
	// clicked right after the add+toastr flow, whose fading cdk-overlay backdrop sits over the toolbar and
	// swallows a coordinate click; dispatchClick fires save() directly. Race the open against the
	// approval-policy/request-approval fetch the dialog issues on init so the next nameInput assertion
	// doesn't run before the form renders; the response wait is bounded + best-effort so a missed match
	// can't hang the step.
	const page = getPage();
	await waitForSpinnerGone();
	await Promise.all([
		page
			.waitForResponse((res) => res.url().includes('/api/approval-policy/request-approval'), { timeout: 30000 })
			.catch(() => undefined),
		dispatchClick(ApprovalRequestPage.editApprovalRequestButtonCss)
	]);
};

export const deleteApprovalRequestButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const clickDeleteApprovalRequestButton = async () => {
	// Delete (toolbar trash button -> delete(item)) opens the confirmation dialog. Clicked right after the
	// edit save+toastr flow, whose fading cdk-overlay backdrop sits over the toolbar — a coordinate click
	// lands on the backdrop and the confirm dialog never opens. Wait out any spinner, then dispatch the
	// click straight to the button.
	await waitForSpinnerGone();
	await dispatchClick(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// The actual delete only fires when the confirmation dialog's OK (status="danger") is clicked.
	// dispatchClick fires the handler directly so a fading backdrop from the just-opened dialog can't
	// intercept it.
	await dispatchClick(ApprovalRequestPage.confirmDeleteButtonCss);
};

export const approvalPolicyButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.approvalPolicyButtonCss);
};

export const clickApprovalPolicyButton = async () => {
	// "Approval Policy" navigates to /pages/organization/approval-policy (router.navigate, not a dialog).
	// This button is clicked right after the addTag/addEmployee dialog flows, whose fading cdk-overlay
	// backdrop can swallow a coordinate click — the click was lost and the test stayed on the approvals
	// page (then opened the request, not policy, dialog). dispatchClick fires the (click) handler directly,
	// and we wait for the route change so the next steps don't race the in-flight navigation.
	await dispatchClick(ApprovalRequestPage.approvalPolicyButtonCss);
	await getPage()
		.waitForURL((url) => /\/pages\/organization\/approval-policy(\?|$)/.test(url.href), { timeout: 30000 })
		.catch(() => undefined);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(ApprovalRequestPage.descriptionInputCss);
	await enterInput(ApprovalRequestPage.descriptionInputCss, data);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.backButtonCss);
};

export const clickBackButton = async () => {
	// The approval-policy page's ngx-back-navigation button calls location.back() (browser history), NOT a
	// router.navigate to the approvals route. Because the approvals route was entered via a hash-only SPA
	// navigation that doesn't always leave a distinct history entry, location.back() can OVERSHOOT past the
	// approvals page straight to Manage Employees (/#/pages/employees) — the next step would then run on the
	// employees grid and the request never appears. Click Back, then force the hash to the approvals route so
	// we're guaranteed to land there regardless of how deep history.back() went.
	await clickButton(ApprovalRequestPage.backButtonCss);
	await gotoApprovals();
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ApprovalRequestPage.toastrMessageCss);
};

export const verifyApprovalPolicyExists = async (text) => {
	// Filter the (server-side, paginated) policy grid to our uniquely-named policy first so it's guaranteed
	// to render — an unfiltered page 1 may not include it once earlier specs/runs have created policies.
	const page = getPage();
	await waitForSpinnerGone();
	const filter = page.locator(ApprovalRequestPage.policyNameFilterInputCss).first();
	await filter.fill(String(text)).catch(() => undefined);
	await page.waitForTimeout(1500); // server-side filter is debounced — let the refetch land
	await waitForSpinnerGone();
	await verifyText(ApprovalRequestPage.verifyApprovalPolicyCss, text);
};

export const verifyRequestExists = async (text) => {
	// Re-filter the grid to THIS name before asserting. Two reasons: (1) pollution — the shared grid is
	// paginated over a client-side LocalDataSource accumulating rows from earlier specs/runs, so an
	// unfiltered tbody may not even render our row on page 1; (2) the edit step renames the request, which
	// leaves the grid still filtered by the OLD name from selectTableRow — verifying the NEW name needs the
	// filter reset to that new name. Filtering by the unique faker name shows exactly our (renamed) record.
	await searchRequestByName(text);
	await verifyText(ApprovalRequestPage.verifyRequestCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	// Re-filter to the (now-deleted) name first so the assertion is order-independent: after filtering, a
	// genuinely deleted record yields zero matching rows (verifyTextNotExisting -> count 0 of that name),
	// whereas a leftover same-named row from another spec/run would still be absent under OUR unique name.
	await searchRequestByName(text);
	await verifyTextNotExisting(ApprovalRequestPage.tableBodyCss, text);
};

export const clickSaveButtonWithForce = async () => {
	await clickButtonWithForce(ApprovalRequestPage.saveButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(ApprovalRequestPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(ApprovalRequestPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(ApprovalRequestPage.nameInputCss);
};

export const verifyApprovalRefuseButton = async (text: string, index: number) => {
	await verifyTextByIndex(ApprovalRequestPage.approvalRefuseButtonCss, text, index);
};

export const clickOnApprovalRefuseButton = async (text: string) => {
	await clickByText(ApprovalRequestPage.approvalRefuseButtonCss, text);
};

export const verifyApprovalButtonNotExist = async (text: string, index: number) => {
	await verifyTextNotExistByIndex(ApprovalRequestPage.approvalRefuseButtonCss, index, text);
};

export const verifyStatus = async (text: string) => {
	await verifyByText(ApprovalRequestPage.rowCss, text);
};

export const verifyNameInput = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.searchByNameInputCss);
};

export const searchApprovalRequest = async (text: string, length: number) => {
	await clearField(ApprovalRequestPage.searchByNameInputCss);
	await enterInput(ApprovalRequestPage.searchByNameInputCss, text);
	await verifyByLength(ApprovalRequestPage.approvalStatusCss, length);
};

export const clearNameSearchInput = async () => {
	await clearField(ApprovalRequestPage.searchByNameInputCss);
};

export const waitTableLoad = async (length: number) => {
	await verifyByLength(ApprovalRequestPage.approvalStatusCss, length);
};
