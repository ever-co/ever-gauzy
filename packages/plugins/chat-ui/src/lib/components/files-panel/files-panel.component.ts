import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbButtonModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { IChatFile } from '@gauzy/contracts';
import { fileSizeLabel, isImageFile, isPlainClick } from '../../chat-attachments';
import { ChatFilesStore } from '../../services/chat-files.store';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { FilePreviewComponent } from '../file-preview/file-preview.component';

/** The files one page of the pane lists. */
export const CHAT_FILES_PAGE = 30;

/**
 * The Files pane of a conversation: every file its messages carry, newest first, with who attached it and when,
 * a page at a time. What it reads also serves the messages on screen ({@link ChatFilesStore}).
 */
@Component({
	selector: 'ngx-chat-files-panel',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbButtonModule, NbIconModule, NbSpinnerModule, TranslatePipe, FilePreviewComponent],
	template: `
		<aside class="panel" data-test="files-panel">
			<h6>{{ 'CHAT.FILES.TITLE' | translate }}</h6>
			@for (file of files(); track file.documentId) {
				<div class="row">
					<nb-icon [icon]="isImage(file) ? 'image-outline' : 'file-text-outline'"></nb-icon>
					@if (file.fileUrl) {
						<a class="name" [href]="file.fileUrl" target="_blank" rel="noopener noreferrer" (click)="open(file, $event)">{{ file.name }}</a>
					} @else {
						<span class="name">{{ file.name }}</span>
					}
					<span class="meta">
						@if (size(file)) {
							{{ size(file) }} ·
						}
						{{ author(file) }} · {{ file.attachedAt | date: 'short' }}
					</span>
				</div>
			} @empty {
				@if (!loading()) {
					<p class="empty">{{ (failed() ? 'CHAT.ERROR' : 'CHAT.FILES.EMPTY') | translate }}</p>
				}
			}
			@if (loading()) {
				<div class="loading" [nbSpinner]="true"></div>
			} @else if (failed()) {
				<button nbButton ghost size="tiny" type="button" data-test="files-retry" (click)="more()">{{ 'CHAT.RETRY' | translate }}</button>
			} @else if (hasMore()) {
				<button nbButton ghost size="tiny" type="button" data-test="files-more" (click)="more()">{{ 'CHAT.FILES.MORE' | translate }}</button>
			}
		</aside>
		@if (preview(); as file) {
			<ngx-chat-file-preview [file]="file" (closed)="preview.set(null)"></ngx-chat-file-preview>
		}
	`,
	styles: [
		`
			.panel {
				max-height: 40%;
				overflow-y: auto;
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid var(--border-basic-color-3);
				background: var(--background-basic-color-2);
			}
			h6 {
				margin: 0 0 0.25rem;
				font-size: 0.75rem;
				text-transform: uppercase;
				color: var(--text-hint-color);
			}
			.row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.25rem 0;
				font-size: 0.8125rem;
				min-width: 0;
			}
			.name {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: inherit;
			}
			.meta {
				flex: 0 0 auto;
				font-size: 0.6875rem;
				color: var(--text-hint-color);
			}
			.empty {
				margin: 0.25rem 0;
				font-size: 0.8125rem;
				color: var(--text-hint-color);
			}
			.loading {
				min-height: 3rem;
			}
		`
	]
})
export class FilesPanelComponent {
	private readonly api = inject(ChatUiService);
	private readonly store = inject(ChatFilesStore);
	private readonly destroyRef = inject(DestroyRef);

	readonly conversationId = input.required<string>();
	readonly people = input.required<ChatPeople>();

	protected readonly files = signal<IChatFile[]>([]);
	protected readonly hasMore = signal(false);
	protected readonly loading = signal(false);
	protected readonly failed = signal(false);
	/**
	 * How many of the API's rows (attachment links, one per message carrying a file) were read: the next page's
	 * `skip`. Not the files shown, which name each document once.
	 */
	private consumed = 0;

	constructor() {
		effect(() => {
			const id = this.conversationId();
			untracked(() => {
				this.files.set([]);
				this.hasMore.set(false);
				this.consumed = 0;
				this.load(id, 0);
			});
		});
	}

	/** The file shown in the popup. */
	protected readonly preview = signal<IChatFile | null>(null);

	/** A plain click shows the file in the popup; with a modifier key the link opens as links do. */
	protected open(file: IChatFile, event: MouseEvent): void {
		if (!isPlainClick(event)) return;
		event.preventDefault();
		this.preview.set(file);
	}

	protected more(): void {
		this.load(this.conversationId(), this.consumed);
	}

	private load(id: string, skip: number): void {
		// The scope the read is made for: a late answer for another user or organization is dropped.
		const scope = this.store.currentScope;
		this.loading.set(true);
		this.failed.set(false);
		this.api
			.files(id, { limit: CHAT_FILES_PAGE, skip })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					if (this.conversationId() !== id || scope !== this.store.currentScope) return;
					// One entry per document, within this page too (two messages may carry one document).
					const seen = new Set(this.files().map((file) => String(file.documentId)));
					const fresh = result.files.filter((file) => {
						const id = String(file.documentId);
						if (seen.has(id)) return false;
						seen.add(id);
						return true;
					});
					this.files.set([...this.files(), ...fresh]);
					this.hasMore.set(result.hasMore);
					// A full page (more follows) read exactly the page size of rows; the last page, what it answered.
					this.consumed = skip + (result.hasMore ? CHAT_FILES_PAGE : result.files.length);
					this.loading.set(false);
					this.store.add(result.files, scope);
				},
				error: () => {
					if (this.conversationId() !== id) return;
					this.loading.set(false);
					this.failed.set(true);
				}
			});
	}

	protected isImage(file: IChatFile): boolean {
		return isImageFile(file.mimeType);
	}

	protected size(file: IChatFile): string {
		return fileSizeLabel(file.fileSize);
	}

	protected author(file: IChatFile): string {
		const people = this.people();
		const person =
			(file.authorEmployeeId ? people.byEmployee.get(String(file.authorEmployeeId)) : null) ??
			(file.authorUserId ? people.byUser.get(String(file.authorUserId)) : null);
		return person?.name ?? '…';
	}
}
