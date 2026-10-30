import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

/**
 * The Documents panel's image popup: one picture, its name, a download and a close.
 *
 * 🛑 **Standalone**, like the attach dialog: it is opened from the standalone panel on
 * app pages where `DocsUiModule` — and the hub's own preview modal with it — is not in
 * scope. The panel owns the `blob:` URL (it also feeds the grid's thumbnails), so the
 * dialog only asks for it through `resolveSrc` and never revokes it.
 */
@Component({
	selector: 'gz-document-image-preview-dialog',
	standalone: true,
	imports: [CommonModule, TranslatePipe, NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, NbTooltipModule],
	templateUrl: './document-image-preview-dialog.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	styleUrls: ['./document-image-preview-dialog.component.scss']
})
export class DocumentImagePreviewDialogComponent extends TranslationBaseComponent implements OnInit {
	/** The file name, for the header, the image's alt text and the download. */
	@Input() name = '';
	/** Resolves the image's `blob:` URL — from the user's machine for a held file, from the server otherwise. */
	@Input() resolveSrc!: () => Promise<string | null>;

	public src: string | null = null;
	public loading = true;
	public failed = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<DocumentImagePreviewDialogComponent>
	) {
		super(translateService);
	}

	async ngOnInit(): Promise<void> {
		try {
			this.src = await this.resolveSrc();
			this.failed = !this.src;
		} catch {
			this.failed = true;
		} finally {
			this.loading = false;
		}
	}

	/** A picture that will not decode (a corrupt or mislabelled file) reads as a failed load. */
	onImageError(): void {
		this.failed = true;
	}

	close(): void {
		this.dialogRef.close();
	}
}
