export const OrganizationHelpCenterPage = {
	addButtonCss: 'div.add-icon-field > button[status="success"]',
	languageDropdownCss: 'div.form-group > ngx-language-selector > ng-select',
	// Language is an ng-select (template="ng-select", appendTo="body") — its options render in body as
	// div.ng-option, NOT the nb-select overlay. Keep this separate from the icon nb-select options so an
	// index/text pick can't accidentally hit the wrong dropdown's list.
	languageOptionCss: 'div.ng-option',
	dropdownOptionCss: '.ng-option, .option-list nb-option',
	toggleButtonCss: 'nb-toggle:has-text("Publish Status")',
	iconDropdownCss:
		'nb-select#icon > button.select-button',
	// Icon is an nb-select (id="icon") — its options render in the overlay as .option-list nb-option.
	iconOptionCss: '.option-list nb-option',
	colorInputCss: 'input[id="color"]',
	nameInputCss: 'input[id="name"]',
	descriptioninputCss: 'input[id="description"]',
	saveButtonCss: 'nb-card-footer.text-left > button[status="success"]',
	settingsButtonCss: 'nb-action.icons',
	deleteButtonCss: 'nb-card-footer.save-button > button[status="danger"]',
	settingsDropdownOptionCss: 'nb-menu.context-menu > ul.menu-items li',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyBaseCss: 'div.base > div > span.text',
	closeDeleteButtonCss: 'g[data-name="close"]',
	verifyCategortCss: 'div[class="base ng-star-inserted child"]',
	arrowButtonCss:'span.toggle-children',
	addArticleButtonCss: 'button[status="success"]',
	nameOfTheArticleInputCss: 'input[formcontrolname="name"]',
	descOfTheArticleInputCss: 'input[formcontrolname="desc"]',
	employeePlaceholderCss: 'ga-employee-multi-select nb-select',
	employeeDropdownCss: 'ul.option-list > nb-option',
	articleTextCss: 'div[id="cke_1_contents"] > iframe[class="cke_wysiwyg_frame cke_reset"]',
	articleSaveBtnCss: 'div.save-button > button[status="success"]'
};
