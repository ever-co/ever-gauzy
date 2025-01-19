import { Injectable } from '@angular/core';
import { IFileSaveStrategy } from '../../../models/video-download.model';

@Injectable({
	providedIn: 'root'
})
export class FileSaveStrategy implements IFileSaveStrategy {
	/*
	 * Save file
	 * @method save
	 * @param {Blob} blob
	 * @param {string} filename
	 * @returns {void}
	 * */
	public save(blob: Blob, filename: string): void {
		const link = document.createElement('a');
		const blobUrl = URL.createObjectURL(blob);
		link.href = blobUrl;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(blobUrl);
	}
}
