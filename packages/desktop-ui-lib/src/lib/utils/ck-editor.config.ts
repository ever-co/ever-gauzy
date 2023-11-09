import { CKEditor4 } from 'ckeditor4-angular';

export class CkEditorConfig {
	public static minimal(): CKEditor4.Config {
		return {
			width: '100%',
			height: '100%',
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
	}
}
