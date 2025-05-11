import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
	selector: 'lib-file-upload',
	templateUrl: './file-upload.component.html',
	styleUrls: ['./file-upload.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileUploadComponent {
	@ViewChild('fileInput') fileInput: ElementRef;
	@Input() allowedExtensions: string[] = ['.zip'];
	@Input() maxFileSize: number = 1024 * 1024 * 1024; // 1GB
	@Input() dragDropText: string;
	@Input() orText: string;
	@Input() browseText: string;
	@Input() restrictionsText: string;
	@Input() removeText: string;
	@Output() fileSelected = new EventEmitter<File>();
	@Output() fileRemoved = new EventEmitter<void>();

	selectedFile: File | null = null;
	errorMessage: string | null = null;
	isDragOver = false;

	public onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			this.processFile(input.files[0]);
		}
	}

	public onDragEnter(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = true;
	}

	public onDragOver(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = true;
	}

	public onDragLeave(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = false;
	}

	public onDrop(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = false;

		if (event.dataTransfer?.files.length > 0) {
			this.processFile(event.dataTransfer.files[0]);
		}
	}

	private preventDefault(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
	}

	private processFile(file: File): void {
		const fileExtension = this.getFileExtension(file.name);
		if (!this.allowedExtensions.includes(fileExtension)) {
			this.errorMessage = `Invalid file type. Allowed types: ${this.allowedExtensions.join(', ')}`;
			this.selectedFile = null;
			return;
		}

		if (file.size > this.maxFileSize) {
			this.errorMessage = `File size exceeds the maximum limit of ${this.formatFileSize(this.maxFileSize)}`;
			this.selectedFile = null;
			return;
		}

		this.selectedFile = file;
		this.errorMessage = null;
		this.fileSelected.emit(file);
	}

	private getFileExtension(filename: string): string {
		return filename.substring(filename.lastIndexOf('.')).toLowerCase();
	}

	public removeFile(event: Event): void {
		this.preventDefault(event);
		this.selectedFile = null;
		this.errorMessage = null;
		this.fileRemoved.emit();
	}

	public formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	}

	public triggerFileBrowse(): void {
		this.fileInput.nativeElement.click();
	}
}
