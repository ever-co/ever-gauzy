export const ImportExportPage = {
	headerTextCss: 'span.menu-setting',
	subheaderTextCss: 'nb-card-header h4',
	// Since the Import/Export settings polish (#10538, b1ac7714ea) every action is one
	// `section.actions-panel > div.action-row`: an icon, `.action-copy` (h6 title + `p.info`
	// description) and the action's `button.action` on the end side. The old `.button-import`
	// button tray and the loose `div.info` lines below it are gone.
	infoTextCss: 'section.actions-panel .action-copy p.info',
	importBtnCss: 'section.actions-panel .action-row > button.action[status="success"]',
	exportBtnCss: 'section.actions-panel .action-row > button.action[status="info"]',
	migrateBtnCss: 'section.actions-panel .action-row > button.action[status="warning"]',
	downloadTemplatesButtonCss:
		'section.actions-panel .action-row > button.action:has(nb-icon[icon="file-text-outline"])',
	passwordInputCss: 'nb-form-field input[type="password"]',
	okBtnCss: 'nb-card-footer > button[status="success"]',
	cancelBtnCss: 'nb-card-footer > button[status="danger"]',
	browseFilesBtnCss: '.uploader-zone button[status="primary"]',
	fileInputCss: '.uploader-zone input[type="file"]',
	importFileBtnCss: '.gauzy-button-container button.action[status="success"]',
	removeFileBtnCss: '.gauzy-button-container button.action:has(nb-icon[status="danger"])',
	verifyFileNameCss: '.custom-body.queue .col-4',
	verifyUploadStatusCss: '.custom-body.queue nb-badge[status="success"]'
};
