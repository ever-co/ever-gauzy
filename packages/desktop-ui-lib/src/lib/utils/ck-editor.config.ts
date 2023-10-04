import { CKEditor4 } from 'ckeditor4-angular';

export class CkEditorConfig {
	public static minimal(): CKEditor4.Config {
		return {
			width: '100%',
			height: '100%',
			toolbar: [
				{ name: 'document', items: ['Source'] },
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
						'Code',
					],
				},
				{ name: 'styles', items: ['Format', 'Link', 'Heading'] },
				{ name: 'clipboard', groups: ['clipboard', 'undo'] },
				{
					name: 'editing',
					groups: ['find', 'selection', 'spellchecker'],
				},
				{
					name: 'basicstyles',
					groups: [
						'bold',
						'italic',
						'underline',
						'strikethrough',
						'removeformat',
					],
					items: ['Bold', 'Italic', 'Underline'],
				},
				{ name: 'links', groups: ['Link', 'Unlink'] },
				{
					name: 'paragraph',
					groups: [
						'list',
						'indent',
						'blocks',
						'align',
						'bidi',
						'paragraph',
					],
				},
				'/',
				{ name: 'styles', groups: ['Styles'] },
				{ name: 'colors', groups: ['TextColor', 'BGColor'] },
				{ name: 'tools', groups: ['Maximize'] },
				{ name: 'about', groups: ['About'] },
			],
			toolbarCanCollapse: true,
			format_tags: 'p;h1;h2;pre',
			removeButtons:
				'Cut,Copy,Paste,Undo,Redo,Anchor,Underline,Subscript,Superscript',
		};
	}
}
