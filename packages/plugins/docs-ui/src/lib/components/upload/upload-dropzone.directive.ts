import { Directive, EventEmitter, HostBinding, HostListener, Output } from '@angular/core';

/**
 * Page-wide drag & drop dropzone. Attach to the browse page root; emits the
 * dropped `File[]` and toggles a `docs-dropzone-active` class while a drag
 * hovers so the host can render the overlay hint.
 */
@Directive({
	selector: '[gzDocsUploadDropzone]',
	standalone: false
})
export class UploadDropzoneDirective {
	@Output() filesDropped = new EventEmitter<File[]>();
	@Output() dragActiveChange = new EventEmitter<boolean>();

	@HostBinding('class.docs-dropzone-active')
	public dragActive = false;

	private dragDepth = 0;

	@HostListener('dragenter', ['$event'])
	onDragEnter(event: DragEvent): void {
		if (!this.hasFiles(event)) return;
		event.preventDefault();
		this.dragDepth++;
		this.setActive(true);
	}

	@HostListener('dragover', ['$event'])
	onDragOver(event: DragEvent): void {
		if (!this.hasFiles(event)) return;
		event.preventDefault();
	}

	@HostListener('dragleave', ['$event'])
	onDragLeave(event: DragEvent): void {
		if (!this.hasFiles(event)) return;
		event.preventDefault();
		this.dragDepth = Math.max(0, this.dragDepth - 1);
		if (this.dragDepth === 0) this.setActive(false);
	}

	@HostListener('drop', ['$event'])
	onDrop(event: DragEvent): void {
		if (!this.hasFiles(event)) return;
		event.preventDefault();
		this.dragDepth = 0;
		this.setActive(false);
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length) this.filesDropped.emit(files);
	}

	private hasFiles(event: DragEvent): boolean {
		return !!event.dataTransfer?.types?.includes('Files');
	}

	private setActive(active: boolean): void {
		if (this.dragActive !== active) {
			this.dragActive = active;
			this.dragActiveChange.emit(active);
		}
	}
}
