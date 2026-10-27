// The criterions tab (ga-interview-criterions) was rebuilt in #10359 (75957d91aa): the technology stack
// (ga-candidate-technologies) and personal qualities (ga-candidate-personal-qualities) panels now both
// render the shared ga-candidate-criterion-card (packages/ui-core/shared/src/lib/candidate/
// candidate-criterion-card): a `name` input, `.criterion-actions` with ghost Cancel + PRIMARY Save, and the
// saved criterions as `li.criterion-item` rows (name in `span.criterion-name`, edit-outline / trash-2-outline
// icon buttons). The old `span.col-2 > button[status="success"]`, `div.technology > p.technology-text` and
// `nb-icon[icon="edit"|"close"]` markup is gone.
export const ManageInterviewsCriterionsPage = {
	nameInputCss: 'ga-interview-criterions ga-candidate-technologies input[formcontrolname="name"]',
	// Both cards' Save buttons, in DOM order: index 0 = technology stack, index 1 = personal qualities.
	saveButtonCss: 'ga-interview-criterions ga-candidate-criterion-card .criterion-actions button[status="primary"]',
	verifyTechnologyTextCss: 'ga-interview-criterions ga-candidate-technologies li.criterion-item span.criterion-name',
	editTechnologyButtonCss:
		'ga-interview-criterions ga-candidate-technologies li.criterion-item button:has(nb-icon[icon="edit-outline"])',
	deleteTechnologyButtonCss:
		'ga-interview-criterions ga-candidate-technologies li.criterion-item button:has(nb-icon[icon="trash-2-outline"])',
	verifyQualityTextCss:
		'ga-interview-criterions ga-candidate-personal-qualities li.criterion-item span.criterion-name',
	editQualityButtonCss:
		'ga-interview-criterions ga-candidate-personal-qualities li.criterion-item button:has(nb-icon[icon="edit-outline"])',
	deleteQualityButtonCss:
		'ga-interview-criterions ga-candidate-personal-qualities li.criterion-item button:has(nb-icon[icon="trash-2-outline"])',
	toastrMessageCss: 'nb-toast.ng-trigger',
	qualityInputCss: 'ga-interview-criterions ga-candidate-personal-qualities input[formcontrolname="name"]'
};
