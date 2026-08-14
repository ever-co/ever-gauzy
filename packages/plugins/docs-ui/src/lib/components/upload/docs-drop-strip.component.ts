import { Component, EventEmitter, Input, Output } from '@angular/core';
import { humanizeBytes } from '../../models/docs-format.util';

/**
 * Always-visible upload strip between the filter bar and the list — VISUAL-ONLY
 * on purpose.
 *
 * 🛑 It carries no `gzDocsUploadDropzone` of its own: the directive's `onDrop`
 * calls `preventDefault()` but never `stopPropagation()`, so a second instance
 * nested inside the page-wide one would emit `filesDropped` on the strip AND
 * bubble to the page root — two `onFilesPicked` calls, two classification
 * dialogs per drop. The page-wide directive keeps owning every drop; the strip
 * only mirrors its `dragActiveChange` via `[active]` and forwards clicks/keys to
 * the existing upload flow through `(browse)`.
 */
@Component({
	selector: 'gz-docs-drop-strip',
	templateUrl: './docs-drop-strip.component.html',
	styleUrls: ['./docs-drop-strip.component.scss'],
	standalone: false
})
export class DocsDropStripComponent {
	/** Mirrors the page-wide dropzone's drag state (highlight while a drag hovers the page). */
	@Input() active = false;
	/** Live org limit (`GET /settings` capabilities via UploadQueueService), not the constant. */
	@Input() maxFileSizeBytes = 0;
	@Input() maxFiles = 0;
	/** The hidden file input's accept list (`.pdf,.docx,…`) — the hint derives from it. */
	@Input() set accept(value: string) {
		const seen = new Set<string>();
		const names: string[] = [];
		for (const raw of (value ?? '').split(',')) {
			const name = raw.trim().replace(/^\./, '').toUpperCase();
			// JPG/JPEG are one format to a reader.
			const canonical = name === 'JPEG' ? 'JPG' : name;
			if (canonical && !seen.has(canonical)) {
				seen.add(canonical);
				names.push(canonical);
			}
		}
		this.formats = names.join(', ');
	}
	@Output() browse = new EventEmitter<void>();

	public formats = '';

	get maxFileSize(): string {
		return humanizeBytes(this.maxFileSizeBytes);
	}

	/**
	 * Space activates the strip like a button — without scrolling the page
	 * (preventDefault) and without key-repeat machine-gunning the file picker.
	 * A typed METHOD rather than template statements: for `keydown.space`
	 * pseudo-key bindings the strict template checker types `$event` too
	 * narrowly to reach `KeyboardEvent.repeat` — it fails the PRODUCTION
	 * (full-compilation) build only, which is exactly how it slipped past the
	 * dev-config PR checks and broke the demo webapp image.
	 */
	onSpace(event: KeyboardEvent): void {
		event.preventDefault();
		if (!event.repeat) this.browse.emit();
	}
}
