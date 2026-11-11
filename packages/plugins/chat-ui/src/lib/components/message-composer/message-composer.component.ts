import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { CHAT_MESSAGE_MAX_LENGTH } from '@gauzy/contracts';
import {
	attachmentRoom,
	bodyWithAttachments,
	fileSizeLabel,
	filesOfTransfer,
	PendingAttachment,
	readyAttachmentIds,
	uploadOutcome
} from '../../chat-attachments';
import { ChatEmoji, emojiQueryAt, replaceShortcodeBefore, suggestEmoji } from '../../chat-emoji';
import { CHAT_MENTION_SUGGESTIONS } from '../../chat-ui.constants';
import { apiErrorMessage, ChatPerson, mentionQueryAt, namesToTokens, suggestMentions, tokensToNames, uniqueLabel } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** What the composer hands over: the body with mention tokens, the employees it mentions, and the files it carries. */
export interface ComposerSubmission {
	body: string;
	mentionEmployeeIds: string[];
	/** The stored documents to attach (empty in edit mode: the files of a message stay as they are). */
	attachmentIds: string[];
}

/** Counts the composers of the page, for their element ids. */
let composerCount = 0;

/** The unsent text of each conversation and thread, kept while the page lives (a switch and back finds it again). */
const DRAFTS = new Map<string, string>();

/** Forgets the draft of a place (a send that landed after the person moved on). */
export function clearDraft(draftKey: string): void {
	DRAFTS.delete(draftKey);
}

/**
 * The text box of a conversation or a thread: Enter sends, Shift+Enter breaks the line, `@` opens the people
 * suggestions and `:` the emoji ones (arrows, Enter, Escape; a complete `:name:` becomes its emoji as it is typed).
 * In edit mode it starts with the message's text and offers Save / Cancel.
 * Mentions show as `@Name` (`#channel`) while writing and go out as tokens; each label stands for one id, so two
 * people of one name never swap. The length that counts is the tokenized body's, the one the API measures.
 *
 * Files (where the person may upload documents): picked with the paperclip, dropped on the composer, or pasted.
 * Each is stored at once through the Docs plugin as the sender's own private file, shown as a chip that can be
 * taken off, and goes out with the message; sending waits until every file is stored. A message of files alone
 * carries their names as its text (the platform needs one).
 */
@Component({
	selector: 'ngx-chat-message-composer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<div class="composer" data-test="composer" [class.dragging]="dragging()" (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
			@if (emojiSuggestions().length > 0 && suggestions().length === 0) {
				<ul class="suggestions" role="listbox" data-test="emoji-suggestions" [id]="listId" [attr.aria-label]="'CHAT.COMPOSER.EMOJI_SUGGESTIONS' | translate">
					@for (emoji of emojiSuggestions(); track emoji.code; let index = $index) {
						<li role="option" [id]="optionId(index)" [attr.aria-selected]="index === highlighted()" [class.highlighted]="index === highlighted()" (mousedown)="$event.preventDefault(); pickEmoji(emoji)">
							<span class="emoji">{{ emoji.emoji }}</span>
							<span>:{{ emoji.code }}:</span>
						</li>
					}
				</ul>
			}
			@if (suggestions().length > 0) {
				<ul class="suggestions" role="listbox" data-test="mention-suggestions" [id]="listId" [attr.aria-label]="'CHAT.COMPOSER.MENTION_SUGGESTIONS' | translate">
					@for (person of suggestions(); track person.employeeId; let index = $index) {
						<li role="option" [id]="optionId(index)" [attr.aria-selected]="index === highlighted()" [class.highlighted]="index === highlighted()" (mousedown)="$event.preventDefault(); pick(person)">
							<ngx-chat-person-avatar [person]="person" size="small"></ngx-chat-person-avatar>
							<span>{{ person.name }}</span>
						</li>
					}
				</ul>
			}
			@if (attachments().length > 0 && !editing()) {
				<ul class="attachments" data-test="composer-attachments">
					@for (item of attachments(); track item.key) {
						<li class="attachment" [class.failed]="item.status === 'failed'" [attr.data-status]="item.status">
							<nb-icon [icon]="item.status === 'failed' ? 'alert-circle-outline' : item.status === 'uploading' ? 'cloud-upload-outline' : 'attach-outline'"></nb-icon>
							<span class="attachment-name" [title]="item.name">{{ item.name }}</span>
							@if (item.status === 'uploading') {
								<span class="attachment-meta">{{ 'CHAT.COMPOSER.UPLOADING' | translate }}</span>
							} @else if (item.status === 'failed') {
								<span class="attachment-meta">{{ item.error ?? 'CHAT.COMPOSER.UPLOAD_FAILED' | translate }}</span>
							} @else {
								<span class="attachment-meta">{{ size(item.size) }}</span>
							}
							<button type="button" class="attachment-remove" [attr.aria-label]="'CHAT.COMPOSER.REMOVE_FILE' | translate: { name: item.name }" (click)="removeAttachment(item.key)">
								<nb-icon icon="close-outline"></nb-icon>
							</button>
						</li>
					}
				</ul>
			}
			<textarea
				#box
				nbInput
				fullWidth
				rows="1"
				class="box"
				data-test="composer-box"
				[placeholder]="placeholder()"
				[disabled]="disabled()"
				[attr.aria-label]="placeholder()"
				role="combobox"
				aria-autocomplete="list"
				[attr.aria-expanded]="listOpen()"
				[attr.aria-controls]="listOpen() ? listId : null"
				[attr.aria-activedescendant]="listOpen() ? optionId(highlighted()) : null"
				[attr.maxlength]="max"
				[(ngModel)]="text"
				(ngModelChange)="onInput()"
				(keydown)="onKeyDown($event)"
				(keyup)="onCaretMove()"
				(click)="onCaretMove()"
				(paste)="onPaste($event)"
			></textarea>
			<div class="footer">
				<span class="hint" [class.over]="isTooLong()">
					@if (isTooLong()) {
						{{ 'CHAT.COMPOSER.TOO_LONG' | translate: { max: max } }}
					} @else {
						{{ 'CHAT.COMPOSER.HINT' | translate }}
					}
				</span>
				<span class="buttons">
					@if (canAttach() && !editing()) {
						<input #picker type="file" multiple hidden data-test="composer-file-input" (change)="onPicked($event)" />
						<button
							nbButton
							ghost
							size="tiny"
							type="button"
							data-test="composer-attach"
							[disabled]="disabled() || room() === 0"
							[nbTooltip]="'CHAT.COMPOSER.ATTACH' | translate"
							[attr.aria-label]="'CHAT.COMPOSER.ATTACH' | translate"
							(click)="picker.click()"
						>
							<nb-icon icon="attach-outline"></nb-icon>
						</button>
					}
					@if (editing()) {
						<button nbButton ghost size="tiny" type="button" data-test="composer-cancel" (click)="editCancelled.emit()">{{ 'CHAT.COMPOSER.CANCEL' | translate }}</button>
					}
					<button nbButton status="primary" size="tiny" type="button" data-test="composer-send" [disabled]="!canSend()" (click)="send()">
						{{ (editing() ? 'CHAT.COMPOSER.SAVE' : 'CHAT.COMPOSER.SEND') | translate }}
					</button>
				</span>
			</div>
		</div>
	`,
	styles: [
		`
			.composer {
				position: relative;
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}
			.box {
				resize: vertical;
				min-height: 2.5rem;
				max-height: 12rem;
				font: inherit;
			}
			.footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
			}
			.hint {
				font-size: 0.6875rem;
				opacity: 0.6;
			}
			.hint.over {
				opacity: 1;
				color: var(--color-danger-default, #e4493f);
			}
			.buttons {
				display: flex;
				gap: 0.25rem;
			}
			.suggestions {
				position: absolute;
				bottom: 100%;
				left: 0;
				z-index: 20;
				min-width: 14rem;
				max-height: 14rem;
				overflow-y: auto;
				margin: 0 0 0.25rem;
				padding: 0.25rem;
				list-style: none;
				border-radius: 0.375rem;
				background: var(--card-background-color, #fff);
				box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
			}
			.suggestions li {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.25rem 0.5rem;
				border-radius: 0.25rem;
				cursor: pointer;
				font-size: 0.875rem;
			}
			.suggestions li.highlighted,
			.suggestions li:hover {
				background: rgba(127, 127, 127, 0.15);
			}
			.suggestions .emoji {
				width: 1.5rem;
				text-align: center;
				font-size: 1.125rem;
			}
			.composer.dragging {
				outline: 2px dashed var(--color-primary-default);
				outline-offset: 2px;
				border-radius: var(--border-radius);
			}
			.attachments {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}
			.attachment {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				max-width: 100%;
				padding: 0.125rem 0.25rem 0.125rem 0.5rem;
				border: 1px solid var(--border-basic-color-3);
				border-radius: var(--border-radius);
				background: var(--background-basic-color-1);
				font-size: 0.75rem;
			}
			.attachment.failed {
				border-color: var(--color-danger-default);
			}
			.attachment-name {
				max-width: 12rem;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.attachment-meta {
				color: var(--text-hint-color);
			}
			.attachment-remove {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.25rem;
				height: 1.25rem;
				padding: 0;
				border: 0;
				border-radius: var(--border-radius);
				background: transparent;
				color: inherit;
				cursor: pointer;
			}
			.attachment-remove:hover,
			.attachment-remove:focus-visible {
				background: var(--background-basic-color-3);
			}
		`
	]
})
export class MessageComposerComponent {
	private readonly api = inject(ChatUiService);
	private readonly destroyRef = inject(DestroyRef);

	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
	readonly placeholder = input('');
	readonly disabled = input(false);
	/** The message being edited (its body with tokens), or null for a new message. */
	readonly initialBody = input<string | null>(null);
	readonly editing = input(false);
	/** Where the unsent text belongs (a conversation, a thread): it is kept per key and found again on return. */
	readonly draftKey = input<string | null>(null);
	/** Clears the box (and the draft of the key) after this submission counter changes (the parent sent it). */
	readonly resetToken = input(0);
	/** Whether the person may attach files (`DOCS_CREATE`: they are stored as documents). */
	readonly canAttach = input(false);

	readonly submitted = output<ComposerSubmission>();
	/** The person left edit mode without saving. */
	readonly editCancelled = output<void>();

	private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

	protected readonly max = CHAT_MESSAGE_MAX_LENGTH;
	protected text = '';
	/** `@label` → employee id and `#label` → conversation id, as shown in the box. */
	private picked = new Map<string, string>();
	private channels = new Map<string, string>();
	/** Whether the person typed since the box was last filled (a late people list must not overwrite that). */
	private dirty = false;
	private lastReset = 0;
	private filledKey: string | null = null;
	protected readonly length = signal(0);
	protected readonly query = signal<{ query: string; start: number } | null>(null);
	protected readonly highlighted = signal(0);
	/** The `:` query under the caret (only when no `@` query is open). */
	protected readonly emojiQuery = signal<{ query: string; start: number } | null>(null);
	protected readonly attachments = signal<PendingAttachment[]>([]);
	protected readonly dragging = signal(false);
	private readonly uploads = new Map<number, Subscription>();
	private nextKey = 0;
	/**
	 * Where Escape closed the suggestions: they stay closed while the text and the caret are as they were then (the
	 * Escape's own keyup, a click on the same spot), and open again once either changes.
	 */
	private dismissed: { text: string; caret: number } | null = null;

	protected readonly suggestions = computed(() => {
		const query = this.query();
		if (!query) return [] as ChatPerson[];
		return suggestMentions(this.people().list, query.query, CHAT_MENTION_SUGGESTIONS);
	});
	protected readonly emojiSuggestions = computed(() => {
		const query = this.emojiQuery();
		return query ? suggestEmoji(query.query, CHAT_MENTION_SUGGESTIONS) : ([] as ChatEmoji[]);
	});
	/** Whether a suggestion list is shown (the box is then a combobox that owns it). */
	protected readonly listOpen = computed(() => this.suggestions().length > 0 || this.emojiSuggestions().length > 0);
	/** Ids that tie the box to its suggestion list and the highlighted option, unique per composer. */
	protected readonly listId = `chat-composer-suggestions-${(composerCount += 1)}`;
	protected readonly isTooLong = computed(() => this.length() > this.max);
	protected readonly uploading = computed(() => this.attachments().some((item) => item.status === 'uploading'));
	protected readonly room = computed(() => attachmentRoom(this.attachments()));
	protected readonly canSend = computed(() => {
		const editing = this.editing();
		const hasFiles = !editing && readyAttachmentIds(this.attachments()).length > 0;
		return (this.length() > 0 || hasFiles) && !this.isTooLong() && !this.disabled() && (editing || !this.uploading());
	});

	constructor() {
		// The box is filled when the edited message or the place changes: with the message's text, or the draft of the place.
		effect(() => {
			const initial = this.initialBody();
			const key = this.draftKey();
			untracked(() => {
				// The files picked belong to the place they were picked in.
				if (key !== this.filledKey) this.dropAttachments();
				this.filledKey = key;
				this.fill(initial, key);
			});
		});
		this.destroyRef.onDestroy(() => this.dropAttachments());
		// Names that arrive after the box was filled replace the `…` labels, as long as nothing was typed since.
		effect(() => {
			this.people();
			this.conversationNames();
			untracked(() => {
				const initial = this.initialBody();
				if (initial !== null && !this.dirty) this.fill(initial, this.draftKey());
			});
		});
		effect(() => {
			const token = this.resetToken();
			untracked(() => {
				if (token === this.lastReset) return;
				this.lastReset = token;
				this.clear();
			});
		});
	}

	focus(): void {
		this.box()?.nativeElement.focus();
	}

	private fill(initial: string | null, key: string | null): void {
		if (initial !== null) {
			const labels = tokensToNames(initial, this.people().byEmployee, this.conversationNames());
			this.text = labels.text;
			this.picked = labels.people;
			this.channels = labels.channels;
			queueMicrotask(() => this.focus());
		} else {
			const labels = tokensToNames(key ? (DRAFTS.get(key) ?? '') : '', this.people().byEmployee, this.conversationNames());
			this.text = labels.text;
			this.picked = labels.people;
			this.channels = labels.channels;
		}
		this.dirty = false;
		this.query.set(null);
		this.measure();
	}

	private clear(): void {
		this.text = '';
		this.picked = new Map();
		this.channels = new Map();
		this.dirty = false;
		const key = this.draftKey();
		if (key) DRAFTS.delete(key);
		this.length.set(0);
		this.query.set(null);
		this.emojiQuery.set(null);
		this.dropAttachments();
	}

	/** The body as the API would receive it, and its length (the one that counts). */
	private tokenized(): string {
		return namesToTokens(this.text.trim(), this.picked, this.channels);
	}

	private measure(): void {
		this.length.set(this.tokenized().length);
	}

	private keepDraft(): void {
		const key = this.draftKey();
		if (!key || this.editing()) return;
		const body = this.tokenized();
		if (body) DRAFTS.set(key, body);
		else DRAFTS.delete(key);
	}

	protected onInput(): void {
		this.dirty = true;
		this.replaceShortcode();
		this.measure();
		this.keepDraft();
		this.onCaretMove();
	}

	/** A complete `:name:` just typed becomes its emoji, the caret right after it. */
	private replaceShortcode(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		const replaced = replaceShortcodeBefore(this.text, element.selectionStart ?? this.text.length);
		if (!replaced) return;
		this.text = replaced.text;
		element.value = replaced.text;
		element.setSelectionRange(replaced.caret, replaced.caret);
	}

	protected onCaretMove(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		const caret = element.selectionStart ?? this.text.length;
		if (this.dismissed && this.dismissed.text === this.text && this.dismissed.caret === caret) {
			this.query.set(null);
			this.emojiQuery.set(null);
			return;
		}
		this.dismissed = null;
		const next = mentionQueryAt(this.text, caret);
		const current = this.query();
		const emoji = next ? null : emojiQueryAt(this.text, caret);
		const currentEmoji = this.emojiQuery();
		if (next?.query !== current?.query || next?.start !== current?.start || emoji?.query !== currentEmoji?.query || emoji?.start !== currentEmoji?.start) {
			this.query.set(next);
			this.emojiQuery.set(emoji);
			this.highlighted.set(0);
		}
	}

	protected onKeyDown(event: KeyboardEvent): void {
		const emojis = this.suggestions().length === 0 ? this.emojiSuggestions() : [];
		if (emojis.length > 0) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const step = event.key === 'ArrowDown' ? 1 : -1;
				this.highlighted.set((this.highlighted() + step + emojis.length) % emojis.length);
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				this.pickEmoji(emojis[this.highlighted()] ?? emojis[0]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				this.dismiss();
				return;
			}
		}
		const suggestions = this.suggestions();
		if (suggestions.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				this.highlighted.set((this.highlighted() + 1) % suggestions.length);
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				this.highlighted.set((this.highlighted() - 1 + suggestions.length) % suggestions.length);
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				this.pick(suggestions[this.highlighted()]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				this.dismiss();
				return;
			}
		}
		if (event.key === 'Escape' && this.editing()) {
			event.preventDefault();
			this.editCancelled.emit();
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			this.send();
		}
	}

	protected pick(person: ChatPerson): void {
		const query = this.query();
		const element = this.box()?.nativeElement;
		if (!query || !element) return;
		const caret = element.selectionStart ?? this.text.length;
		const label = uniqueLabel(person.name, person.employeeId, this.picked);
		const insertion = `@${label} `;
		this.text = `${this.text.slice(0, query.start)}${insertion}${this.text.slice(caret)}`;
		this.picked.set(label, person.employeeId);
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.query.set(null);
		const position = query.start + insertion.length;
		queueMicrotask(() => {
			element.focus();
			element.setSelectionRange(position, position);
		});
	}

	protected optionId(index: number): string {
		return `${this.listId}-${index}`;
	}

	/** Closes the open suggestions until the text or the caret changes. */
	private dismiss(): void {
		const element = this.box()?.nativeElement;
		this.dismissed = { text: this.text, caret: element?.selectionStart ?? this.text.length };
		this.query.set(null);
		this.emojiQuery.set(null);
	}

	/** Puts the emoji in place of the `:` query and moves the caret after it. */
	protected pickEmoji(emoji: ChatEmoji): void {
		const query = this.emojiQuery();
		const element = this.box()?.nativeElement;
		if (!query || !element) return;
		const caret = element.selectionStart ?? this.text.length;
		const insertion = `${emoji.emoji} `;
		this.text = `${this.text.slice(0, query.start)}${insertion}${this.text.slice(caret)}`;
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.emojiQuery.set(null);
		const position = query.start + insertion.length;
		queueMicrotask(() => {
			element.focus();
			element.setSelectionRange(position, position);
		});
	}

	protected send(): void {
		if (!this.canSend()) return;
		const editing = this.editing();
		const text = this.tokenized();
		const attachmentIds = editing ? [] : readyAttachmentIds(this.attachments());
		const body = editing ? text : bodyWithAttachments(text, this.attachments());
		const mentionEmployeeIds = [...new Set([...this.picked.values()].filter((id) => body.includes(`<@${id}>`)))];
		this.submitted.emit({ body, mentionEmployeeIds, attachmentIds });
	}

	// ---------------------------------------------------------------- files

	protected size(bytes: number): string {
		return fileSizeLabel(bytes);
	}

	protected onPicked(event: Event): void {
		const picker = event.target as HTMLInputElement | null;
		this.addFiles(Array.from(picker?.files ?? []));
		// The same file can be picked again after it was taken off.
		if (picker) picker.value = '';
	}

	protected onDragOver(event: DragEvent): void {
		if (!this.canAttach() || this.editing() || !Array.from(event.dataTransfer?.types ?? []).includes('Files')) return;
		event.preventDefault();
		this.dragging.set(true);
	}

	protected onDrop(event: DragEvent): void {
		this.dragging.set(false);
		const files = filesOfTransfer(event.dataTransfer);
		if (!files.length || !this.canAttach() || this.editing()) return;
		event.preventDefault();
		this.addFiles(files);
	}

	/** A pasted picture (or file) is attached; pasted text is left to the box. */
	protected onPaste(event: ClipboardEvent): void {
		const files = filesOfTransfer(event.clipboardData);
		if (!files.length || !this.canAttach() || this.editing()) return;
		event.preventDefault();
		this.addFiles(files);
	}

	/** Stores each file at once (as many as the message can still take), one request per file. */
	addFiles(files: readonly File[]): void {
		if (!this.canAttach() || this.editing() || this.disabled()) return;
		for (const file of files.slice(0, this.room())) {
			this.nextKey += 1;
			const key = this.nextKey;
			this.attachments.update((list) => [
				...list,
				{ key, name: file.name || 'file', size: file.size, mimeType: file.type, status: 'uploading', documentId: null, error: null }
			]);
			const upload = this.api.uploadFile(file).subscribe({
				next: (answer) => {
					const outcome = uploadOutcome(answer);
					this.patchAttachment(key, 'documentId' in outcome ? { status: 'ready', documentId: outcome.documentId } : { status: 'failed', error: outcome.error });
				},
				error: (error: HttpErrorResponse) => {
					// No Docs plugin (or no right to upload) answers 404 / 403: attachments are not available here.
					const unavailable = error?.status === 404 || error?.status === 403;
					this.patchAttachment(key, {
						status: 'failed',
						error: unavailable ? 'CHAT.COMPOSER.ATTACH_UNAVAILABLE' : (apiErrorMessage(error) ?? 'CHAT.COMPOSER.UPLOAD_FAILED')
					});
				}
			});
			if (this.attachments().some((item) => item.key === key && item.status === 'uploading')) this.uploads.set(key, upload);
		}
	}

	protected removeAttachment(key: number): void {
		this.uploads.get(key)?.unsubscribe();
		this.uploads.delete(key);
		this.attachments.update((list) => list.filter((item) => item.key !== key));
	}

	private patchAttachment(key: number, patch: Partial<PendingAttachment>): void {
		this.uploads.delete(key);
		this.attachments.update((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
	}

	private dropAttachments(): void {
		for (const upload of this.uploads.values()) upload.unsubscribe();
		this.uploads.clear();
		if (this.attachments().length) this.attachments.set([]);
	}
}
