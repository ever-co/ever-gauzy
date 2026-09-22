export const EmployeeAddInfoPage = {
    gridButtonCss: 'div.layout-switch > button',
	addNewLevelButtonCss: 'button[status="success"]:has(nb-icon[icon="plus-outline"])',
	newLevelInputCss: '[placeholder="Level name"]',
	tagsSelectCss: '#addTags',
	// The tags ng-select option ITSELF, not the checkbox its template happens to render: '[type="checkbox"]'
	// matched every checkbox on the page, and it is the option div that carries ng-select's
	// (click)="toggleItem(item)". ':not(.ng-option-disabled)' is applied by the shared driver.
	tagsSelectOptionCss: 'div.ng-option',
	saveNewLevelButtonCss: 'button[status="success"]:has-text("Save")',
    cancelNewLevelButtonCss: 'button[status="basic"]:has-text("Cancel")',
    toastrMessageCss: 'nb-toast.ng-trigger',
    menuButtonsCss: 'nb-menu > ul.menu-items > li',
    employeeSelectorCss: 'ga-employee-selector',
	selectEmployeeDropdownOptionCss: 'ng-dropdown-panel > div[class="ng-dropdown-panel-items scroll-host"] > div > div.ng-star-inserted',
    editIconBtnCss: 'div.employee-details > span > nb-icon',
    tabBtnCss: 'ul.route-tabset > li',
    shortDecsInputCss: 'input[id="shortDescription"]',
    formCss: 'ga-edit-employee-employment',
    levelInputFieldCss: 'ng-select[formcontrolname="employeeLevel"]',
    levelDropdownOptCss: 'div.ng-option',
    saveBtnCss: 'div.actions > button[status="success"]',
    shortDecsCss: 'div.employee-info'

};