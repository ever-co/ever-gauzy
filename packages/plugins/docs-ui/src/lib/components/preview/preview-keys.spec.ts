import { previewTakesArrowKey } from './preview-keys';

/**
 * Embedded in the full-width file page, the PDF preview shares the screen with the Documents tree, the details
 * column and the dialogs they open (review on #10642): an arrow key pressed there must not turn
 * the PDF's page.
 */
describe('previewTakesArrowKey', () => {
	let host: HTMLElement;
	let inside: HTMLElement;
	let outside: HTMLElement;

	beforeEach(() => {
		document.body.innerHTML = '<div id="tree" tabindex="0"></div><div id="preview"><div id="card" tabindex="0"><input id="field" /><div id="editor" contenteditable="true"></div></div></div>';
		host = document.getElementById('preview');
		inside = document.getElementById('card');
		outside = document.getElementById('tree');
	});

	it('pages a PDF in its dialog wherever the key is pressed', () => {
		expect(previewTakesArrowKey(false, host, outside)).toBe(true);
		expect(previewTakesArrowKey(false, host, null)).toBe(true);
	});

	it('pages an embedded PDF only for keys pressed inside the preview', () => {
		expect(previewTakesArrowKey(true, host, inside)).toBe(true);
		expect(previewTakesArrowKey(true, host, outside)).toBe(false);
		expect(previewTakesArrowKey(true, host, document.body)).toBe(false);
		expect(previewTakesArrowKey(true, host, null)).toBe(false);
	});

	it('leaves the arrow keys to a field being edited, even inside the preview', () => {
		expect(previewTakesArrowKey(true, host, document.getElementById('field'))).toBe(false);
		const editor = document.getElementById('editor');
		Object.defineProperty(editor, 'isContentEditable', { value: true });
		expect(previewTakesArrowKey(true, host, editor)).toBe(false);
	});
});
