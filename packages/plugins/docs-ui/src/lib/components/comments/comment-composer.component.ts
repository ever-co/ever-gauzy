import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ID } from '@gauzy/contracts';
import {
	applyMentionPick,
	collectMentionEmployeeIds,
	detectMentionToken,
	IMentionCandidate,
	IMentionToken
} from './document-comments.model';
import { MentionDirectoryService } from './mention-directory.service';

/** What a composer hands back — the text plus the ids the backend fans notifications out to. */
export interface ICommentDraft {
	comment: string;
	mentionEmployeeIds: ID[];
}

/**
 * Plain-text comment box with an `@` mention menu (spec 01 §8.10 / 08 §1).
 *
 * The same component is the new-comment box, the reply box and the inline
 * editor — only the labels and the seed text change. Text is deliberately plain:
 * `Comment.comment` is a `text` column that the notification e-mail renders
 * verbatim, so a rich-text body would arrive as markup in someone's inbox.
 *
 * 🛑 The `@` menu does not itself notify anyone. Picking an employee records the
 * label written into the text; on submit `collectMentionEmployeeIds()` reports
 * only the picks still present in the body, and the backend
 * (`CommentService.create` → `MentionService.publishMention`) does the fan-out
 * from that array. Dropping a name from the text therefore un-notifies them,
 * which is the behaviour people expect from a draft they edited.
 */
@Component({
	selector: 'gz-docs-comment-composer',
	template: `
		<div class="gz-comment-composer" [class.compact]="compact">
			<textarea
				#input
				nbInput
				fullWidth
				fieldSize="small"
				[rows]="compact ? 2 : 3"
				[value]="text"
				[disabled]="pending"
				[placeholder]="placeholderKey | translate"
				[attr.aria-label]="placeholderKey | translate"
				(input)="onInput($event)"
				(keydown)="onKeyDown($event)"
				(blur)="closeMentions()"
			></textarea>

			<ul
				class="gz-comment-mentions"
				*ngIf="mentionsOpen && suggestions.length"
				role="listbox"
				[attr.aria-label]="'DOCS.COMMENTS.MENTION_ARIA' | translate"
			>
				<li *ngFor="let candidate of suggestions; let index = index">
					<button
						type="button"
						role="option"
						[attr.aria-selected]="index === activeIndex"
						[class.active]="index === activeIndex"
						(mousedown)="pick(candidate, $event)"
					>
						<nb-icon icon="person-outline"></nb-icon>
						<span>{{ candidate.label }}</span>
					</button>
				</li>
			</ul>

			<div class="gz-comment-composer-actions">
				<span class="gz-comment-hint">{{ 'DOCS.COMMENTS.MENTION_HINT' | translate }}</span>
				<button *ngIf="cancellable" nbButton ghost size="tiny" type="button" (click)="cancelled.emit()">
					{{ 'DOCS.COMMENTS.CANCEL' | translate }}
				</button>
				<button
					nbButton
					status="primary"
					size="tiny"
					type="button"
					[disabled]="!canSubmit"
					(click)="submit()"
				>
					{{ submitLabelKey | translate }}
				</button>
			</div>
		</div>
	`,
	styles: [
		`
			.gz-comment-composer {
				position: relative;
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}
			.gz-comment-composer textarea {
				resize: vertical;
			}
			.gz-comment-composer-actions {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}
			.gz-comment-hint {
				flex: 1 1 auto;
				font-size: 0.6875rem;
				color: var(--text-hint-color);
			}
			.gz-comment-mentions {
				position: absolute;
				z-index: 10;
				top: 100%;
				left: 0;
				right: 0;
				margin: 0.125rem 0 0;
				padding: 0.25rem;
				list-style: none;
				max-height: 12rem;
				overflow-y: auto;
				border: 1px solid var(--border-basic-color-3);
				border-radius: 0.375rem;
				background: var(--background-basic-color-1);
				box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.12);
			}
			.gz-comment-mentions button {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				width: 100%;
				padding: 0.25rem 0.375rem;
				border: 0;
				border-radius: 0.25rem;
				background: transparent;
				color: var(--text-basic-color);
				font: inherit;
				text-align: left;
				cursor: pointer;
			}
			.gz-comment-mentions button:hover,
			.gz-comment-mentions button.active {
				background: var(--background-basic-color-2);
			}
		`
	],
	standalone: false
})
export class CommentComposerComponent implements OnChanges {
	/** Seed text — set by the inline editor, empty for a new comment or reply. */
	@Input() value = '';
	/** Employees already mentioned in `value`, so an edit keeps notifying them. */
	@Input() picked: IMentionCandidate[] = [];
	@Input() placeholderKey = 'DOCS.COMMENTS.PLACEHOLDER';
	@Input() submitLabelKey = 'DOCS.COMMENTS.POST';
	/** True while the parent's request is in flight — the box locks, it does not clear. */
	@Input() pending = false;
	@Input() cancellable = false;
	/** Reply/edit boxes sit inside a comment and get less vertical room. */
	@Input() compact = false;

	@Output() submitted = new EventEmitter<ICommentDraft>();
	@Output() cancelled = new EventEmitter<void>();

	@ViewChild('input') private inputRef?: ElementRef<HTMLTextAreaElement>;

	public text = '';
	public suggestions: IMentionCandidate[] = [];
	public activeIndex = 0;
	public mentionsOpen = false;

	/** Every employee picked from the menu in this composer, plus the seeded ones. */
	private mentioned: IMentionCandidate[] = [];
	private token: IMentionToken | null = null;
	/** Guards against a slow directory response painting a menu for a token already gone. */
	private sequence = 0;

	constructor(private readonly directory: MentionDirectoryService) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['value']) this.text = this.value ?? '';
		if (changes['picked']) this.mentioned = [...(this.picked ?? [])];
	}

	get canSubmit(): boolean {
		return !this.pending && this.text.trim().length > 0;
	}

	// ─── Typing ──────────────────────────────────────────────────

	async onInput(event: Event): Promise<void> {
		const target = event.target as HTMLTextAreaElement;
		this.text = target.value;
		this.token = detectMentionToken(this.text, target.selectionStart ?? this.text.length);
		if (!this.token) {
			this.closeMentions();
			return;
		}
		await this.loadSuggestions(this.token.query);
	}

	/**
	 * Arrow keys / Enter / Escape belong to the menu while it is open; Enter alone
	 * would otherwise post a comment the author was still naming someone in.
	 */
	onKeyDown(event: KeyboardEvent): void {
		if (this.mentionsOpen && this.suggestions.length) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				this.activeIndex = (this.activeIndex + 1) % this.suggestions.length;
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				this.activeIndex = (this.activeIndex - 1 + this.suggestions.length) % this.suggestions.length;
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				this.pick(this.suggestions[this.activeIndex]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				this.closeMentions();
				return;
			}
		}
		// Enter posts only with a modifier — a plain Enter is a new paragraph.
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			this.submit();
		}
	}

	// ─── Mentions ────────────────────────────────────────────────

	pick(candidate?: IMentionCandidate, event?: Event): void {
		// `mousedown`, not `click`: the textarea's blur would close the menu first.
		event?.preventDefault();
		if (!candidate || !this.token) return;

		const caret = this.inputRef?.nativeElement.selectionStart ?? this.text.length;
		const applied = applyMentionPick(this.text, this.token, caret, candidate.label);
		this.text = applied.text;
		if (!this.mentioned.some((entry) => String(entry.id) === String(candidate.id))) {
			this.mentioned = [...this.mentioned, candidate];
		}
		this.closeMentions();
		this.focusAt(applied.caret);
	}

	closeMentions(): void {
		this.mentionsOpen = false;
		this.suggestions = [];
		this.activeIndex = 0;
		this.token = null;
	}

	private async loadSuggestions(query: string): Promise<void> {
		const mySequence = ++this.sequence;
		const candidates = await firstValueFrom(this.directory.search(query));
		if (mySequence !== this.sequence || !this.token) return;
		this.suggestions = candidates;
		this.activeIndex = 0;
		this.mentionsOpen = candidates.length > 0;
	}

	// ─── Submit ──────────────────────────────────────────────────

	submit(): void {
		if (!this.canSubmit) return;
		const comment = this.text.trim();
		this.submitted.emit({
			comment,
			mentionEmployeeIds: collectMentionEmployeeIds(comment, this.mentioned)
		});
	}

	/** Clears the box after the parent confirms the post landed. */
	reset(): void {
		this.text = '';
		this.mentioned = [];
		this.closeMentions();
	}

	private focusAt(caret: number): void {
		const element = this.inputRef?.nativeElement;
		if (!element) return;
		element.value = this.text;
		element.focus();
		element.setSelectionRange(caret, caret);
	}
}
