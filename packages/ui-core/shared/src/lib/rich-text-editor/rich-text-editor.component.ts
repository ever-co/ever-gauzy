import { Component, Input, OnInit, OnDestroy, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Editor, schema, toDoc, toHTML, Toolbar } from 'ngx-editor';

@Component({
	selector: 'rich-text-editor',
	templateUrl: './rich-text-editor.component.html',
	styleUrls: ['./rich-text-editor.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => RichTextEditorComponent),
			multi: true
		}
	],
	standalone: false
})
export class RichTextEditorComponent implements OnInit, OnDestroy, ControlValueAccessor {
	@Input() toolbar: Toolbar = [
		['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript'],
		['code', 'blockquote', 'horizontal_rule'],
		['ordered_list', 'bullet_list'],
		[{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
		[{ link: { showOpenInNewTab: false } }, 'image'],
		['text_color', 'background_color'],
		['align_left', 'align_center', 'align_right', 'align_justify'],
		['indent', 'outdent'],
		['format_clear'],
		['undo', 'redo']
	];

	@Input() height = '320px';
	@Input() editorClass = '';
	@Input() control: any = null;

	editor: Editor;
	value = null;

	onChange = (_: any) => {};
	onTouched = () => {};

	ngOnInit() {
		this.editor = new Editor({
			history: true,
			inputRules: true,
			keyboardShortcuts: true
		});
	}

	writeValue(obj: any): void {
		if (typeof obj === 'string') {
			const doc = toDoc(obj, schema);
			this.value = doc;
		}
	}

	registerOnChange(fn: any): void {
		this.onChange = (val: any) => {
			const html = toHTML(val, schema);
			fn(html);
		};
	}

	registerOnTouched(fn: any): void {
		this.onTouched = fn;
	}

	ngOnDestroy(): void {
		this.editor?.destroy();
	}
}
