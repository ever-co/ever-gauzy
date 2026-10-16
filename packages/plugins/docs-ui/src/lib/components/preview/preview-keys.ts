/**
 * Whether a document-level arrow key should page the PDF a preview shows.
 *
 * In its dialog the preview is the only thing the viewer is working with, so every arrow key pages it. Embedded
 * in a page (`inline`) it shares the screen with the Documents tree, the details column and the dialogs those
 * open — an arrow key there belongs to them. Inline, the preview takes a key only when the focus is inside the
 * preview itself, and never from a field being edited.
 *
 * @param inline Whether the preview is embedded in a page.
 * @param host The preview's own element.
 * @param target Where the key was pressed (the focused element).
 * @returns True to page the PDF.
 */
export function previewTakesArrowKey(inline: boolean, host: Element | null, target: EventTarget | null): boolean {
	if (!inline) {
		return true;
	}
	const element = target instanceof Element ? target : null;
	if (!element || !host?.contains(element)) {
		return false;
	}
	return !isEditable(element);
}

/** A text field or an editable region, where arrow keys move the caret. */
function isEditable(element: Element): boolean {
	const tag = element.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
		return true;
	}
	return element instanceof HTMLElement && element.isContentEditable;
}
