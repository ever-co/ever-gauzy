import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { CHAT_MESSAGE_MAX_LENGTH } from '@gauzy/contracts';
import { CHAT_COMPOSER_EMOJI, CHAT_MENTION_SUGGESTIONS } from '../../chat-ui.constants';
import { ChatPerson, mentionQueryAt, namesToTokens, suggestMentions, tokensToNames, uniqueLabel } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** What the composer hands over: the body with mention tokens, and the employees it mentions. */
export interface ComposerSubmission {
	body: string;
	mentionEmployeeIds: string[];
}

/** The unsent text of each conversation and thread, kept while the page lives (a switch and back finds it again). */
const DRAFTS = new Map<string, string>();

/** Forgets the draft of a place (a send that landed after the person moved on). */
export function clearDraft(draftKey: string): void {
	DRAFTS.delete(draftKey);
}

/** A Markdown mark the formatting bar puts around the selection (or at the start of each selected line). */
type ComposerFormat = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'list' | 'quote';

/** The text box grows with what is typed up to this height (px), then scrolls. */
const MAX_BOX_HEIGHT_PX = 240;

/**
 * The text box of a conversation or a thread, framed as chat apps do: a formatting bar (bold, italic, strike,
 * code, link, list, quote: the Markdown the API stores), the box (it grows with its text), and a bottom bar with
 * the emoji and mention buttons and the send button. Enter sends, Shift+Enter breaks the line, `@` opens the
 * people suggestions (arrows, Enter, Escape). In edit mode it starts with the message's text and offers Save /
 * Cancel. Mentions show as `@Name` (`#channel`) while writing and go out as tokens; each label stands for one id,
 * so two people of one name never swap. The length that counts is the tokenized body's, the one the API measures.
 */
@Component({
	selector: 'ngx-chat-message-composer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbIconModule, NbTooltipModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<div class="composer" data-test="composer" [class.editing]="editing()">
			@if (suggestions().length > 0) {
				<ul class="composer-popover suggestions" role="listbox" data-test="mention-suggestions">
					@for (person of suggestions(); track person.employeeId; let index = $index) {
						<li role="option" [attr.aria-selected]="index === highlighted()" [class.highlighted]="index === highlighted()" (mousedown)="$event.preventDefault(); pick(person)">
							<ngx-chat-person-avatar [person]="person" size="small"></ngx-chat-person-avatar>
							<span class="person-name">{{ person.name }}</span>
						</li>
					}
				</ul>
			}
			@if (emojiOpen()) {
				<div class="composer-popover emoji-grid" role="menu" data-test="composer-emoji">
					@for (emoji of emojiChoices; track emoji) {
						<button type="button" class="emoji" role="menuitem" [attr.aria-label]="emoji" (mousedown)="$event.preventDefault()" (click)="insertEmoji(emoji)">{{ emoji }}</button>
					}
				</div>
			}
			@if (editing()) {
				<div class="edit-banner">
					<nb-icon icon="edit-outline"></nb-icon>
					<strong>{{ 'CHAT.COMPOSER.EDITING' | translate }}</strong>
					<span class="edit-hint">{{ 'CHAT.COMPOSER.EDITING_HINT' | translate }}</span>
				</div>
			}
			<div class="frame" [class.focused]="focused()" [class.disabled]="disabled()" [class.over]="isTooLong()">
				<div class="format-bar" role="toolbar">
					@for (tool of formats; track tool.format) {
						<button
							type="button"
							class="tool"
							[disabled]="disabled()"
							[nbTooltip]="tool.labelKey | translate"
							[attr.aria-label]="tool.labelKey | translate"
							(mousedown)="$event.preventDefault()"
							(click)="format(tool.format)"
						>
							@if (tool.icon) {
								<nb-icon [icon]="tool.icon"></nb-icon>
							} @else {
								<span class="glyph" [class]="'glyph-' + tool.format">{{ tool.glyph }}</span>
							}
						</button>
						@if (tool.divider) {
							<span class="divider"></span>
						}
					}
				</div>
				<textarea
					#box
					rows="1"
					class="box"
					data-test="composer-box"
					[placeholder]="placeholder()"
					[disabled]="disabled()"
					[attr.aria-label]="placeholder()"
					[attr.maxlength]="max"
					[(ngModel)]="text"
					(ngModelChange)="onInput()"
					(keydown)="onKeyDown($event)"
					(keyup)="onCaretMove()"
					(click)="onCaretMove()"
					(focus)="focused.set(true)"
					(blur)="focused.set(false)"
				></textarea>
				<div class="bottom-bar">
					<button
						type="button"
						class="tool"
						[class.on]="emojiOpen()"
						[disabled]="disabled()"
						[nbTooltip]="'CHAT.COMPOSER.EMOJI' | translate"
						[attr.aria-label]="'CHAT.COMPOSER.EMOJI' | translate"
						[attr.aria-expanded]="emojiOpen()"
						(mousedown)="$event.preventDefault()"
						(click)="emojiOpen.set(!emojiOpen())"
					>
						<nb-icon icon="smiling-face-outline"></nb-icon>
					</button>
					<button
						type="button"
						class="tool at"
						[disabled]="disabled()"
						[nbTooltip]="'CHAT.COMPOSER.MENTION' | translate"
						[attr.aria-label]="'CHAT.COMPOSER.MENTION' | translate"
						(mousedown)="$event.preventDefault()"
						(click)="startMention()"
					>
						&#64;
					</button>
					<span class="spacer"></span>
					@if (isTooLong()) {
						<span class="counter over">{{ length() }} / {{ max }}</span>
					}
					@if (editing()) {
						<button type="button" class="text-button" data-test="composer-cancel" (click)="editCancelled.emit()">{{ 'CHAT.COMPOSER.CANCEL' | translate }}</button>
						<button type="button" class="text-button primary" data-test="composer-send" [disabled]="!canSend()" (click)="send()">{{ 'CHAT.COMPOSER.SAVE' | translate }}</button>
					} @else {
						<button
							type="button"
							class="send"
							data-test="composer-send"
							[class.ready]="canSend()"
							[disabled]="!canSend()"
							[nbTooltip]="'CHAT.COMPOSER.SEND' | translate"
							[attr.aria-label]="'CHAT.COMPOSER.SEND' | translate"
							(click)="send()"
						>
							<nb-icon icon="paper-plane-outline"></nb-icon>
						</button>
					}
				</div>
			</div>
			<div class="hint" [class.over]="isTooLong()">
				@if (isTooLong()) {
					{{ 'CHAT.COMPOSER.TOO_LONG' | translate: { max: max } }}
				} @else {
					{{ 'CHAT.COMPOSER.HINT' | translate }}
				}
			</div>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.composer {
				position: relative;
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}
			.edit-banner {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				padding: 0 0.25rem;
				color: var(--chat-accent, #3366ff);
				font-size: 0.6875rem;
			}
			.edit-hint {
				color: var(--chat-muted, inherit);
			}
			.frame {
				display: flex;
				flex-direction: column;
				border: 1px solid var(--chat-border-strong, rgba(127, 127, 127, 0.35));
				border-radius: 0.5rem;
				background: var(--chat-bg, transparent);
				transition: border-color 0.12s ease, box-shadow 0.12s ease;
			}
			.frame.focused {
				border-color: var(--chat-text-soft, rgba(127, 127, 127, 0.7));
				box-shadow: 0 0.0625rem 0.375rem rgba(0, 0, 0, 0.08);
			}
			.composer.editing .frame {
				border-color: var(--chat-accent, #3366ff);
			}
			.frame.over {
				border-color: var(--chat-danger, #e4493f);
			}
			.frame.disabled {
				opacity: 0.7;
			}
			.format-bar,
			.bottom-bar {
				display: flex;
				align-items: center;
				gap: 0.125rem;
				padding: 0.25rem 0.375rem;
			}
			.format-bar {
				border-radius: 0.5rem 0.5rem 0 0;
				background: var(--chat-composer-bar, rgba(127, 127, 127, 0.05));
			}
			.divider {
				width: 1px;
				height: 1.125rem;
				margin: 0 0.25rem;
				background: var(--chat-border, rgba(127, 127, 127, 0.3));
			}
			.box {
				display: block;
				width: 100%;
				min-height: 2.5rem;
				max-height: 15rem;
				padding: 0.5rem 0.75rem;
				border: 0;
				outline: 0;
				resize: none;
				overflow-y: auto;
				background: transparent;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.875rem;
				line-height: 1.4667;
			}
			.box::placeholder {
				color: var(--chat-muted, rgba(127, 127, 127, 0.9));
			}
			.tool {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				font: inherit;
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.tool nb-icon {
				font-size: 1rem;
			}
			.tool.at {
				font-size: 1rem;
				font-weight: 700;
			}
			.glyph {
				font-size: 0.9375rem;
				line-height: 1;
			}
			.glyph-bold {
				font-weight: 800;
			}
			.glyph-italic {
				font-family: Georgia, 'Times New Roman', serif;
				font-style: italic;
				font-weight: 600;
			}
			.glyph-strike {
				text-decoration: line-through;
				font-weight: 600;
			}
			.glyph-quote {
				font-size: 1.125rem;
			}
			.tool:hover:not(:disabled),
			.tool:focus-visible,
			.tool.on {
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text, inherit);
			}
			.tool:disabled {
				cursor: default;
				opacity: 0.5;
			}
			.spacer {
				flex: 1 1 auto;
			}
			.counter {
				margin-right: 0.5rem;
				font-size: 0.6875rem;
				font-weight: 600;
			}
			.counter.over {
				color: var(--chat-danger, #e4493f);
			}
			.send {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 1.75rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				cursor: pointer;
				transition: background-color 0.12s ease, color 0.12s ease;
			}
			.send nb-icon {
				font-size: 1rem;
			}
			.send.ready {
				background: var(--chat-send, #007a5a);
				color: #fff;
			}
			.send.ready:hover {
				filter: brightness(1.08);
			}
			.send:disabled {
				cursor: default;
				opacity: 0.6;
			}
			.text-button {
				height: 1.75rem;
				margin-left: 0.25rem;
				padding: 0 0.75rem;
				border: 1px solid var(--chat-border-strong, rgba(127, 127, 127, 0.35));
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 600;
				cursor: pointer;
			}
			.text-button:hover:not(:disabled) {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.text-button.primary {
				border-color: transparent;
				background: var(--chat-send, #007a5a);
				color: #fff;
			}
			.text-button:disabled {
				cursor: default;
				opacity: 0.5;
			}
			.hint {
				min-height: 1rem;
				padding: 0 0.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.625rem;
				text-align: right;
			}
			.hint.over {
				color: var(--chat-danger, #e4493f);
			}
			/* Not \`.popover\`: the app's global Bootstrap \`.popover\` (top: 0, max-width: 276px) squashed these panels. */
			.composer-popover {
				position: absolute;
				top: auto;
				bottom: calc(100% + 0.25rem);
				left: 0;
				z-index: 20;
				box-sizing: border-box;
				max-width: none;
				margin: 0;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				background: var(--chat-raised, #fff);
				box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
			}
			.suggestions {
				min-width: 16rem;
				max-height: 16rem;
				overflow-y: auto;
				padding: 0.375rem;
				list-style: none;
			}
			.suggestions li {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				padding: 0.375rem 0.5rem;
				border-radius: 0.375rem;
				cursor: pointer;
				font-size: 0.8125rem;
			}
			.suggestions li.highlighted,
			.suggestions li:hover {
				background: var(--chat-accent, #3366ff);
				color: var(--chat-on-accent, #fff);
			}
			.person-name {
				font-weight: 600;
			}
			.emoji-grid {
				display: grid;
				grid-template-columns: repeat(8, 2.25rem);
				gap: 0.125rem;
				padding: 0.375rem;
			}
			.emoji {
				width: 2.25rem;
				height: 2.25rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				font-size: 1.25rem;
				cursor: pointer;
				transition: transform 0.08s ease, background-color 0.08s ease;
			}
			.emoji:hover,
			.emoji:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				transform: scale(1.12);
			}
			@media (max-width: 600px) {
				.hint {
					display: none;
				}
				.emoji-grid {
					grid-template-columns: repeat(6, 2.25rem);
				}
			}
		`
	]
})
export class MessageComposerComponent {
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
	protected readonly length = signal(0);
	protected readonly query = signal<{ query: string; start: number } | null>(null);
	protected readonly highlighted = signal(0);
	protected readonly focused = signal(false);
	protected readonly emojiOpen = signal(false);

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	protected readonly emojiChoices = CHAT_COMPOSER_EMOJI;
	/** The formatting bar: an Eva icon where the set has one, a styled letter (`glyph`) where it has none. */
	protected readonly formats: readonly { format: ComposerFormat; icon?: string; glyph?: string; labelKey: string; divider?: boolean }[] = [
		{ format: 'bold', glyph: 'B', labelKey: 'CHAT.COMPOSER.BOLD' },
		{ format: 'italic', glyph: 'I', labelKey: 'CHAT.COMPOSER.ITALIC' },
		{ format: 'strike', glyph: 'S', labelKey: 'CHAT.COMPOSER.STRIKE', divider: true },
		{ format: 'link', icon: 'link-2-outline', labelKey: 'CHAT.COMPOSER.LINK', divider: true },
		{ format: 'list', icon: 'list-outline', labelKey: 'CHAT.COMPOSER.LIST' },
		{ format: 'quote', glyph: '❝', labelKey: 'CHAT.COMPOSER.QUOTE', divider: true },
		{ format: 'code', icon: 'code-outline', labelKey: 'CHAT.COMPOSER.CODE' }
	];

	protected readonly suggestions = computed(() => {
		const query = this.query();
		if (!query) return [] as ChatPerson[];
		return suggestMentions(this.people().list, query.query, CHAT_MENTION_SUGGESTIONS);
	});
	protected readonly isTooLong = computed(() => this.length() > this.max);
	protected readonly canSend = computed(() => this.length() > 0 && !this.isTooLong() && !this.disabled());

	constructor() {
		// The box is filled when the edited message or the place changes: with the message's text, or the draft of the place.
		effect(() => {
			const initial = this.initialBody();
			const key = this.draftKey();
			untracked(() => this.fill(initial, key));
		});
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
		this.afterRender(() => this.autosize());
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
		this.emojiOpen.set(false);
		this.afterRender(() => this.autosize());
	}

	/** Runs once the box shows the model's text (`ngModel` writes it a tick after a change). */
	private afterRender(task: () => void): void {
		setTimeout(task);
	}

	/** Grows the box with its text, up to its maximum height (then it scrolls). */
	private autosize(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		element.style.height = 'auto';
		element.style.height = `${Math.min(element.scrollHeight, MAX_BOX_HEIGHT_PX)}px`;
	}

	/** Puts text in place of a range of the box, then selects a range of the result (the caret when empty). */
	private replaceRange(from: number, to: number, insertion: string, selectFrom: number, selectTo: number): void {
		this.text = `${this.text.slice(0, from)}${insertion}${this.text.slice(to)}`;
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.afterRender(() => {
			const element = this.box()?.nativeElement;
			if (!element) return;
			element.focus();
			element.setSelectionRange(selectFrom, selectTo);
			this.autosize();
			this.onCaretMove();
		});
	}

	/** Wraps the selection in a Markdown mark (or prefixes each selected line, for a list or a quote; again to undo it). */
	protected format(kind: ComposerFormat): void {
		const element = this.box()?.nativeElement;
		if (!element || this.disabled()) return;
		const start = element.selectionStart ?? this.text.length;
		const end = element.selectionEnd ?? start;
		const selected = this.text.slice(start, end);
		if (kind === 'list' || kind === 'quote') {
			const prefix = kind === 'list' ? '- ' : '> ';
			const lineStart = this.text.lastIndexOf('\n', start - 1) + 1;
			const lines = this.text.slice(lineStart, end).split('\n');
			const undo = lines.every((line) => line.startsWith(prefix));
			const block = lines.map((line) => (undo ? line.slice(prefix.length) : `${prefix}${line}`)).join('\n');
			this.replaceRange(lineStart, end, block, lineStart + block.length, lineStart + block.length);
			return;
		}
		if (kind === 'link') {
			const insertion = `[${selected}](https://)`;
			const at = selected ? start + selected.length + 3 : start + 1;
			this.replaceRange(start, end, insertion, at, selected ? at + 8 : at);
			return;
		}
		if (kind === 'code' && selected.includes('\n')) {
			const fence = '```';
			const insertion = `${fence}\n${selected}\n${fence}`;
			this.replaceRange(start, end, insertion, start + 4, start + 4 + selected.length);
			return;
		}
		const mark = kind === 'bold' ? '**' : kind === 'italic' ? '_' : kind === 'strike' ? '~~' : '`';
		this.replaceRange(start, end, `${mark}${selected}${mark}`, start + mark.length, start + mark.length + selected.length);
	}

	protected insertEmoji(emoji: string): void {
		const element = this.box()?.nativeElement;
		const start = element?.selectionStart ?? this.text.length;
		const end = element?.selectionEnd ?? start;
		this.emojiOpen.set(false);
		this.replaceRange(start, end, emoji, start + emoji.length, start + emoji.length);
	}

	/** Types an `@` at the caret (after a space when needed), which opens the people suggestions. */
	protected startMention(): void {
		const element = this.box()?.nativeElement;
		const start = element?.selectionStart ?? this.text.length;
		const end = element?.selectionEnd ?? start;
		const before = this.text.slice(0, start);
		const insertion = before && !/\s$/.test(before) ? ' @' : '@';
		this.replaceRange(start, end, insertion, start + insertion.length, start + insertion.length);
	}

	/** A press outside the composer closes its emoji panel. */
	@HostListener('document:mousedown', ['$event'])
	protected onDocumentPress(event: MouseEvent): void {
		if (this.emojiOpen() && !this.host.nativeElement.contains(event.target as Node)) this.emojiOpen.set(false);
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
		this.measure();
		this.keepDraft();
		this.autosize();
		this.onCaretMove();
	}

	protected onCaretMove(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		const next = mentionQueryAt(this.text, element.selectionStart ?? this.text.length);
		const current = this.query();
		if (next?.query !== current?.query || next?.start !== current?.start) {
			this.query.set(next);
			this.highlighted.set(0);
		}
	}

	protected onKeyDown(event: KeyboardEvent): void {
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
				this.query.set(null);
				return;
			}
		}
		if (event.key === 'Escape' && this.emojiOpen()) {
			event.preventDefault();
			this.emojiOpen.set(false);
			return;
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
		this.afterRender(() => {
			element.focus();
			element.setSelectionRange(position, position);
			this.autosize();
		});
	}

	protected send(): void {
		if (!this.canSend()) return;
		const body = this.tokenized();
		const mentionEmployeeIds = [...new Set([...this.picked.values()].filter((id) => body.includes(`<@${id}>`)))];
		this.submitted.emit({ body, mentionEmployeeIds });
	}
}
