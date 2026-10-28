export const FileStoragePage = {
	headerTextCss: 'nb-card-header > h4',
	// The provider form (S3/Wasabi/...) is its own `nb-card.provider-card`; since the file-storage
	// redesign (#10481, 367113adaf) its title sits in `nb-card-header > div.provider-heading > h6`
	// next to an icon, not directly under the header.
	subheaderTextCss: 'nb-card.provider-card .provider-heading > h6',
	selectDropdownCss:
		'file-provider-selector nb-select button.select-button',
	// Footer is now "Check configuration" (ghost, status=basic) + Save (type=submit, status=primary).
	saveButtonCss: 'nb-card-footer.form-actions > button[type="submit"]',
	optionDropdownCss: '.option-list nb-option',
	accesskeyIdInputCss: '[name="aws_access_key_id"]',
	secretAccessKeyInputCss: '[name="aws_secret_access_key"]',
	regionInputCss: '[name="aws_default_region"]',
	bucketInputCss: '[name="aws_bucket"]',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
