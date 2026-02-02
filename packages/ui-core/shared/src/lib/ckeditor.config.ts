import { CKEditor4 } from 'ckeditor4-angular';

export const ckEditorConfig: CKEditor4.Config = {
	width: '100%',
	height: '320',
	toolbar: [
		{
			name: 'document',
			items: ['Source', '-', 'Save', 'NewPage', 'ExportPdf', 'Preview', 'Print', '-', 'Templates']
		},
		{ name: 'clipboard', items: ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo'] },
		{ name: 'editing', items: ['Find', 'Replace', '-', 'SelectAll', '-', 'Scayt'] },
		{
			name: 'forms',
			items: [
				'Form',
				'Checkbox',
				'Radio',
				'TextField',
				'Textarea',
				'Select',
				'Button',
				'ImageButton',
				'HiddenField'
			]
		},
		'/',
		{
			name: 'basicstyles',
			items: [
				'Bold',
				'Italic',
				'Underline',
				'Strike',
				'Subscript',
				'Superscript',
				'-',
				'CopyFormatting',
				'RemoveFormat'
			]
		}
	],
	toolbarCanCollapse: true
};

export const richTextCKEditorConfig: CKEditor4.Config = {
	width: '100%',
	height: '320',
	toolbar: [
		{ name: 'document', items: ['Source'] },
		{ name: 'basicstyles', items: ['Bold', 'Italic', 'Underline'] },
		{
			name: 'paragraph',
			items: [
				'JustifyLeft',
				'JustifyCenter',
				'JustifyRight',
				'JustifyBlock',
				'NumberedList',
				'BulletedList',
				'Checkbox',
				'Blockquote',
				'Code'
			]
		},
		{ name: 'styles', items: ['Format', 'Link', 'Heading'] }
	],
	toolbarCanCollapse: true,
	format_tags: 'p;h1;h2;pre'
};
