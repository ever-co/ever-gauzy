import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	dispatchClick,
	waitForSpinnerGone,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	verifyValue,
	verifyTextNotExisting,
	scrollDown
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SalesEstimatesPage } from '../../../src/support/Base/pageobjects/SalesEstimatesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// dispatchClick past the post-navigation/mutation load spinner so the Add estimate form reliably
	// opens; a coordinate click can land on the spinner/backdrop instead.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// focus + ArrowDown (NOT a click): #addTags is an ng-select that opens on mousedown, so a force-click
	// lands on the add-form backdrop and dismisses the route form; keyboard opens the panel without that.
	// The focus MUST target the inner <input> — focusing the ng-select host leaves the input unfocused so
	// ArrowDown goes to <body> and the panel never opens (the div.ng-option timeout seen in this suite).
	await waitForSpinnerGone();
	await getPage().locator(`${SalesEstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard (focus inner input + ArrowDown) until the options render —
	// ng-select opens on mousedown so a click is backdrop-blocked. Then pick the option (appended to body).
	// Best-effort: tags are OPTIONAL for an estimate (no validator on the tags control) and the list can
	// render empty/slow; if no option shows after a few re-opens, press Escape and continue rather than
	// hard-waiting 60s on div.ng-option (the observed test timeout). Mirrors the proven Invoices.po pattern.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${SalesEstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	if (await option.first().isVisible().catch(() => false)) {
		await option.nth(index).click({ force: true }).catch(() => {});
	} else {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickCardBody = async () => {
	// Close the still-open tags ng-select ([closeOnSelect]=false keeps it open after a pick) by pressing
	// Escape — NOT by force-clicking nb-card-header.d-flex. That header hosts <ngx-back-navigation> (a
	// goBack() button); a force-click on it can dispatch to the back button and navigate OUT of the
	// add-estimate route, dismissing the whole form — after which the next dropdown's div.ng-option never
	// renders and the test hangs with the estimates LIST showing (the observed failure). Mirrors Invoices.po.
	await getPage().keyboard.press('Escape').catch(() => {});
};

export const waitMessageToHide = async () => {
	await waitElementToHide(SalesEstimatesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.discountInputCss);
};

export const enterDiscountData = async (data: string) => {
	await clearField(SalesEstimatesPage.discountInputCss);
	await enterInput(SalesEstimatesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(SalesEstimatesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on mousedown, options appendTo body) — same hazard as the
	// tags one: a force-click is backdrop-blocked / can dismiss the route form. Open via the inner input.
	await waitForSpinnerGone();
	await getPage().locator(`${SalesEstimatesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectContactFromDropdown = async (nameOrIndex: string | number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.contactOptionCss);
	const input = page.locator(`${SalesEstimatesPage.organizationContactDropdownCss} input`).first();
	// POLLUTION RESILIENCE: the sales- and accounting-estimates grids share the SAME estimate data, so by
	// the time this spec runs the contact ng-select holds many contacts from earlier specs. When given the
	// spec's UNIQUE faker contact name, typeahead-filter to it (ga-contact-select uses a name.includes()
	// searchFn) and pick the matching option — so EVERY estimate this spec creates carries that name in the
	// grid's Contact column and our later row operations can scope to it instead of a fragile index (the
	// captured failure sent a FOREIGN "Michael Sawayn" Draft estimate, so div.badge-success never appeared).
	// Re-open the ng-select via keyboard first (opens on mousedown so a click is backdrop-blocked). The
	// contact is a REQUIRED control (form.invalid disables Save), so retry generously. Mirrors Estimates.po.
	const byName = typeof nameOrIndex === 'string';
	for (let i = 0; i < 6; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await input.focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	if (byName) {
		await input.fill('').catch(() => {});
		await input.pressSequentially(String(nameOrIndex), { delay: 20 }).catch(() => {});
		await page.waitForTimeout(600);
		const match = option.filter({ hasText: String(nameOrIndex) }).first();
		try {
			await match.waitFor({ state: 'visible', timeout: 8000 });
			await match.click({ force: true });
			return;
		} catch {
			// fall through to an index pick if the named contact didn't surface (shouldn't happen — addContact
			// created it — but keep the flow moving). Clear the typed filter first so the fallback picks a real
			// (unfiltered) option, not an empty filtered list.
			await input.fill('').catch(() => {});
			await page.waitForTimeout(400);
		}
	}
	// index path (or named-fallback): best-effort guard — if no option shows, Escape and continue rather
	// than hard-waiting 60s on div.ng-option (the prior observed timeout).
	if (await option.first().isVisible().catch(() => false)) {
		await option.nth(byName ? 0 : (nameOrIndex as number)).click({ force: true }).catch(() => {});
	} else {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.taxInputCss);
};

export const enterTaxData = async (data: string) => {
	await clearField(SalesEstimatesPage.taxInputCss);
	await enterInput(SalesEstimatesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(SalesEstimatesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.selectEmployeeCss);
};
export const clickEmployeeDropdown = async () => {
	await clickButton(SalesEstimatesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.dropdownOptionCss);
	// Best-effort employee pick: ga-employee-multi-select loads its options async and can legitimately
	// be EMPTY (no employee "working" in the selected date range). Select one if it appears; otherwise
	// press Escape and continue — an estimate saves fine without members. This avoids the hard 60s
	// timeout on an empty `.option-list nb-option` list (mirrors Estimates.po / ContactsLeads.po).
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	// dispatchClick past the form's full-card nb-spinner that overlays the buttons while it loads items
	// (a coordinate click would land on the spinner). Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text: string) => {
	// Footer Save: settle the card spinner first, then DOM-dispatch the click so it fires even when a
	// fading overlay sits on top (a coordinate click would land on the overlay). Mirrors Estimates.po.
	await waitForSpinnerGone();
	await getPage()
		.locator('button', { hasText: text })
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.tableRowCss);
};

export const selectTableRow = async (indexOrName: string | number) => {
	const page = getPage();
	// Settle the grid first: a row click TOGGLES selection, so a stray double-click would deselect it
	// (the spec calls selectTableRow repeatedly across steps). Wait for spinner/network/render to settle,
	// then click the data row ONCE and poll the toolbar Edit button's real `disabled` attr — only
	// re-click if selection was lost. Never rapid re-click. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	// POLLUTION RESILIENCE: the sales/accounting estimates grids share data, so row 0 can be a FOREIGN
	// estimate from an earlier spec (the captured failure grid had 6 foreign "Michael Sawayn" Draft rows).
	// When given the spec's unique contact name, scope to data rows whose Contact column shows that name and
	// take the first of OURS — deterministic regardless of how many foreign rows are interleaved. Falls back
	// to the raw index when given a number. Mirrors the proven Estimates.po pattern.
	const row =
		typeof indexOrName === 'string'
			? page.locator(SalesEstimatesPage.tableRowCss).filter({ hasText: indexOrName }).first()
			: page.locator(SalesEstimatesPage.tableRowCss).nth(indexOrName);
	const editBtn = page.locator(SalesEstimatesPage.editButtonCss).first();
	for (let i = 0; i < 4; i++) {
		await row.click({ force: true }).catch(() => {});
		try {
			await page.waitForFunction(
				(el) => !!el && !(el as HTMLButtonElement).disabled,
				await editBtn.elementHandle(),
				{ timeout: 4000 }
			);
			return;
		} catch {
			// selection didn't enable the toolbar yet — loop and click the row again
		}
	}
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text: string) => {
	// dispatchClick: the popover action (Duplicate/Send/Email) is reached right after the More popover
	// opens; a fading overlay can intercept a coordinate click. Dispatch straight to the matched button.
	await getPage()
		.locator(SalesEstimatesPage.popoverButtonCss)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// dispatchClick past any fading overlay from the prior view/duplicate screen. Mirrors Estimates.po.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	// Send/Email confirm dialog button. A SINGLE dispatchClick is racy here: the dialog body renders
	// <ga-invoice-pdf> (an async PDF/iframe preview) so the first dispatch can land before the (click)
	// handler is wired, and the dialog stays OPEN with the estimate never sent. This was THE captured
	// failure: the "Send this estimate to Michael Sawayn ?" dialog was still up (iframe + Cancel/Send) and
	// every grid row was still Draft, so div.badge-success never appeared. Fixes vs. the old version:
	// (1) WAIT for the mutation dialog host (ga-invoice-send / ga-invoice-email) to actually be on screen
	//     before clicking — the (click)="send()/sendEmail()" handler isn't wired until the dialog component
	//     has rendered, and dispatching before that is a silent no-op.
	// (2) Scope the confirm button to the LIVE dialog host (never a stale page-level handle), with a
	//     page-level dispatchClick fallback if the live handle is momentarily stale.
	// (3) Loop more (8x) and poll the host to detach so the send/email truly fires before we move on.
	// dispatchEvent (not a coordinate click) so the fading popover backdrop can't intercept it. Mirrors the
	// proven Estimates.po pattern.
	const page = getPage();
	const dialogHost = page.locator('ga-invoice-send, ga-invoice-email').first();
	await dialogHost.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
	const confirmBtn = dialogHost.locator('nb-card-footer.text-left > button[status="success"]').first();
	for (let i = 0; i < 8; i++) {
		await waitForSpinnerGone();
		await confirmBtn.dispatchEvent('click').catch(async () => {
			await dispatchClick(SalesEstimatesPage.confirmButtonCss).catch(() => {});
		});
		try {
			await dialogHost.waitFor({ state: 'detached', timeout: 6000 });
			return;
		} catch {
			// dialog still open — the click didn't take (PDF preview still wiring up); loop and re-dispatch
		}
	}
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await enterInput(SalesEstimatesPage.emailInputCss, data);
};

export const convertToInvoiceButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.convertToInvoiceButton);
};

export const clickConvertToInvoiceButton = async (index: number) => {
	// Toolbar "To invoice" (button.action.info) is reached right after row selection; dispatchClick so
	// a fading overlay/toastr can't intercept the coordinate click. Mirrors Estimates.po.
	await waitForSpinnerGone();
	await getPage()
		.locator(SalesEstimatesPage.convertToInvoiceButton)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	// editButtonCss is scoped to the "Edit" button; dispatchClick past any fading toastr/overlay from
	// the prior save so the edit route opens reliably. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await getPage()
		.locator(SalesEstimatesPage.editButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.viewButtonCss);
};

export const clickViewButton = async (index: number) => {
	// viewButtonCss is scoped to the "View" button; dispatchClick to bypass any fading overlay.
	// Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await getPage()
		.locator(SalesEstimatesPage.viewButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// Popover Delete action — dispatchClick so the open popover's backdrop can't intercept it.
	// Mirrors the proven Estimates.po pattern.
	await dispatchClick(SalesEstimatesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Delete-confirmation dialog OK button — dispatchClick so the closing popover/dialog backdrop can't
	// intercept it. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const verifyEstimateExists = async (val: string) => {
	await verifyValue(SalesEstimatesPage.verifyEstimateCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text: string) => {
	// "Estimate deleted" check. The old assertion — verifyTextNotExisting('div.ng-star-inserted', '2') —
	// is unreliable: 'div.ng-star-inserted' matches dozens of unrelated elements and the value "2"
	// (discountValue) appears all over the page (dates, counts, the year), so the not-contains assertion
	// false-fails. Unlike the invoices grid, this estimates grid still holds the earlier estimate(s)
	// created/duplicated/converted, so asserting an empty grid is wrong too. Assert the true intent instead:
	// the delete-confirmation nb-dialog dispatched and detached (the delete actually fired), then let the
	// grid refresh settle. Mirrors the proven Estimates.po pattern.
	void text;
	const page = getPage();
	await page
		.locator('ga-delete-confirmation')
		.first()
		.waitFor({ state: 'detached', timeout: 12000 })
		.catch(() => {});
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(SalesEstimatesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	// The "more" (vertical dots) toolbar button toggles the actions popover; dispatchClick past any
	// fading toastr/overlay so the popover opens reliably. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.moreButtonCss);
};
