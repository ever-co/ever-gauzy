import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { CHAT_MESSAGE_MAX_LENGTH } from '@gauzy/contracts';
import { CHAT_COMPOSER_EMOJI, CHAT_MENTION_SUGGESTIONS } from '../../chat-ui.constants';
import { ChatMemberIds, markMentions, matchParts, mentionQueryAt, MentionSuggestion, namesToTokens, rankMentions, tokensToNames, uniqueLabel } from '../../chat-ui.helpers';
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

/** One row of the `@` list: a person, or `@channel` / `@here` (in a channel), with the part the query matched. */
type MentionChoice =
	| ({ kind: 'person'; key: string } & MentionSuggestion)
	| { kind: 'everyone'; key: 'channel' | 'here'; labelKey: string; parts: ReturnType<typeof matchParts> };

/** The `@` words that notify a whole channel, and what each one means. */
const EVERYONE_MENTIONS: readonly { key: 'channel' | 'here'; labelKey: string }[] = [
	{ key: 'channel', labelKey: 'CHAT.COMPOSER.MENTION_EVERYONE' },
	{ key: 'here', labelKey: 'CHAT.COMPOSER.MENTION_HERE' }
];

/** The text box grows with what is typed up to this height (px), then scrolls. */
const MAX_BOX_HEIGHT_PX = 240;

/** Gives each composer's `@` list its own id (a conversation and its thread show two composers at once). */
let nextComposerId = 0;

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
	host: {
		'(document:mousedown)': 'onDocumentPress($event)'
	},
	imports: [FormsModule, NbIconModule, NbTooltipModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<div class="composer" data-test="composer" [class.editing]="editing()" (keydown.escape)="onComposerEscape($event)">
			@if (suggestions().length > 0) {
				<div class="composer-popover suggestions" data-test="mention-suggestions">
					<ul class="suggestion-list" role="listbox" [id]="listId" [attr.aria-label]="'CHAT.COMPOSER.MENTION' | translate">
						@for (choice of suggestions(); track choice.key; let index = $index) {
							@if (choice.kind === 'person' && index === 0) {
								<li class="group" role="presentation">{{ 'CHAT.COMPOSER.PEOPLE' | translate }}</li>
							}
							@if (choice.kind === 'everyone' && (index === 0 || suggestions()[index - 1].kind === 'person')) {
								<li class="group" role="presentation">{{ 'CHAT.COMPOSER.NOTIFY' | translate }}</li>
							}
							<li
								class="option"
								role="option"
								[id]="listId + '-' + index"
								[attr.data-index]="index"
								[attr.aria-selected]="index === highlighted()"
								[class.highlighted]="index === highlighted()"
								[class.outside]="choice.kind === 'person' && choice.member === false"
								(mouseenter)="highlighted.set(index)"
								(mousedown)="$event.preventDefault(); pick(choice)"
							>
								@if (choice.kind === 'person') {
									<ngx-chat-person-avatar [person]="choice.person" size="small"></ngx-chat-person-avatar>
								} @else {
									<span class="everyone-icon" aria-hidden="true">&#64;</span>
								}
								<span class="option-name">{{ choice.parts.before }}<mark>{{ choice.parts.match }}</mark>{{ choice.parts.after }}</span>
								@if (choice.kind === 'everyone') {
									<span class="option-detail">{{ choice.labelKey | translate }}</span>
								} @else if (choice.isMe) {
									<span class="option-detail">{{ 'CHAT.COMPOSER.YOU' | translate }}</span>
								} @else if (choice.member === false) {
									<span class="option-detail">{{ 'CHAT.COMPOSER.NOT_MEMBER' | translate }}</span>
								}
								@if (index === highlighted()) {
									<kbd class="option-key" aria-hidden="true">↵</kbd>
								}
							</li>
						}
					</ul>
					<div class="suggestion-hint" aria-hidden="true">
						<span><kbd>↑</kbd><kbd>↓</kbd> {{ 'CHAT.COMPOSER.KEY_NAVIGATE' | translate }}</span>
						<span><kbd>Tab</kbd> / <kbd>↵</kbd> {{ 'CHAT.COMPOSER.KEY_SELECT' | translate }}</span>
						<span><kbd>Esc</kbd> {{ 'CHAT.COMPOSER.KEY_DISMISS' | translate }}</span>
					</div>
				</div>
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
				<div class="box-wrap">
					<!-- Under the (transparent) box, the same text with each mention tinted where it sits. -->
					<!-- Each run sits alone in its span: whitespace around an interpolation would shift the text. -->
					<div #mirror class="box mirror" aria-hidden="true">
						@for (part of marked(); track $index) {
							<span [class.mention-mark]="part.mention">{{ part.text }}</span>
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
					aria-autocomplete="list"
					[attr.aria-controls]="suggestions().length ? listId : null"
					[attr.aria-activedescendant]="suggestions().length ? listId + '-' + highlighted() : null"
					[attr.maxlength]="max"
					[(ngModel)]="text"
					(ngModelChange)="onInput()"
					(keydown)="onKeyDown($event)"
					(keyup)="onCaretMove()"
					(click)="onCaretMove()"
					(focus)="focused.set(true)"
					(blur)="focused.set(false)"
					(scroll)="syncMirror()"
				></textarea>
				</div>
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
						(click)="toggleEmoji($event)"
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
							<span class="send-label">{{ 'CHAT.COMPOSER.SEND' | translate }}</span>
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
			.box-wrap {
				position: relative;
			}
			.box {
				position: relative;
				display: block;
				box-sizing: border-box;
				width: 100%;
				min-height: 2.5rem;
				max-height: 15rem;
				margin: 0;
				padding: 0.5rem 0.75rem;
				border: 0;
				outline: 0;
				resize: none;
				overflow-y: auto;
				/* The same gutter on the box and its layer, so both wrap their lines at the same width. */
				scrollbar-gutter: stable;
				background: transparent;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.875rem;
				line-height: 1.4667;
				letter-spacing: normal;
				word-spacing: normal;
				white-space: pre-wrap;
				overflow-wrap: break-word;
			}
			/* Same box metrics as the textarea, under it; only the mentions' tint shows. */
			.mirror {
				position: absolute;
				inset: 0;
				max-height: none;
				overflow: hidden;
				color: transparent;
				pointer-events: none;
				user-select: none;
			}
			.mention-mark {
				border-radius: 0.1875rem;
				background: var(--chat-mention-chip-bg, rgba(29, 155, 209, 0.16));
				box-shadow: 0 0 0 0.0625rem var(--chat-mention-chip-bg, rgba(29, 155, 209, 0.16));
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
			/* Always in sight: a soft grey button while there is nothing to send, filled once there is. */
			.send {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				gap: 0.375rem;
				height: 2rem;
				margin-left: 0.25rem;
				padding: 0 0.75rem;
				border: 0;
				border-radius: 0.375rem;
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text-soft, inherit);
				font: inherit;
				font-size: 0.8125rem;
				font-weight: 600;
				cursor: pointer;
				transition: background-color 0.12s ease, color 0.12s ease, filter 0.12s ease;
			}
			.send nb-icon {
				font-size: 1rem;
			}
			.send.ready {
				background: var(--chat-send, #007a5a);
				color: #fff;
			}
			.send.ready:hover,
			.send.ready:focus-visible {
				filter: brightness(1.08);
			}
			.send:disabled {
				cursor: default;
				color: var(--chat-muted, inherit);
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
				width: min(22rem, 100%);
				overflow: hidden;
			}
			.suggestion-list {
				max-height: 17rem;
				overflow-y: auto;
				margin: 0;
				padding: 0.25rem;
				list-style: none;
				scrollbar-width: thin;
				scrollbar-color: var(--chat-border-strong, rgba(127, 127, 127, 0.35)) transparent;
			}
			.suggestion-list::-webkit-scrollbar {
				width: 0.375rem;
			}
			.suggestion-list::-webkit-scrollbar-thumb {
				border-radius: 1rem;
				background: var(--chat-border-strong, rgba(127, 127, 127, 0.35));
			}
			.suggestion-hint {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem 0.875rem;
				padding: 0.375rem 0.75rem;
				border-top: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				background: var(--chat-composer-bar, rgba(127, 127, 127, 0.05));
				color: var(--chat-muted, inherit);
				font-size: 0.6875rem;
			}
			.suggestion-hint kbd,
			.option-key {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.125rem;
				height: 1.125rem;
				margin-right: 0.125rem;
				padding: 0 0.25rem;
				border: 1px solid var(--chat-border-strong, rgba(127, 127, 127, 0.35));
				border-radius: 0.25rem;
				background: transparent;
				box-shadow: none;
				color: var(--chat-text-soft, inherit);
				font-family: inherit;
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 1;
			}
			.option-key {
				margin: 0 0 0 auto;
				flex: 0 0 auto;
			}
			.group {
				padding: 0.5rem 0.5rem 0.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.6875rem;
				font-weight: 600;
				letter-spacing: 0.02em;
				cursor: default;
			}
			.group:not(:first-child) {
				margin-top: 0.25rem;
				border-top: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
			}
			.option {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-height: 2rem;
				padding: 0.25rem 0.5rem;
				border-radius: 0.375rem;
				color: var(--chat-text, inherit);
				font-size: 0.8125rem;
				cursor: pointer;
			}
			/* One highlighted row (the mouse moves it too), in the same soft tint as the sidebar's hover and active rows. */
			.option.highlighted {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.option-name {
				overflow: hidden;
				font-weight: 400;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.option-name mark {
				padding: 0;
				background: transparent;
				color: inherit;
				font-weight: 700;
			}
			/* Not in the conversation: still pickable, a step quieter. */
			.option.outside ngx-chat-person-avatar,
			.option.outside .option-name {
				opacity: 0.7;
			}
			.option-detail {
				flex: 0 1 auto;
				overflow: hidden;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.everyone-icon {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 1.5rem;
				height: 1.5rem;
				border-radius: 0.375rem;
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text-soft, inherit);
				font-size: 0.8125rem;
				font-weight: 700;
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
				.send {
					padding: 0 0.625rem;
				}
				.send-label {
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
	/** Whether `@channel` and `@here` are offered (in a channel and its threads). */
	readonly everyone = input(false);
	/** The conversation's members: they come first in the `@` list, the ones known to be outside it say so. */
	readonly memberIds = input<ChatMemberIds | null>(null);
	/** Me, marked "you" and ranked after the others in the `@` list. */
	readonly meEmployeeId = input<string | null>(null);
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
	private readonly mirror = viewChild<ElementRef<HTMLDivElement>>('mirror');

	protected readonly max = CHAT_MESSAGE_MAX_LENGTH;
	/** The `@` list's id; each option's is this plus its index (the box points at the highlighted one). */
	protected readonly listId = `chat-mentions-${++nextComposerId}`;
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
	/** The box's text cut into plain runs and mentions, for the tinted layer under it. */
	protected readonly marked = signal<{ text: string; mention: boolean }[]>([]);

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

	/** People whose name matches the `@` query (the ones starting with it first), then `@channel` / `@here` in a channel. */
	protected readonly suggestions = computed<MentionChoice[]>(() => {
		const query = this.query();
		if (!query) return [];
		const people = rankMentions(this.people().list, query.query, {
			memberIds: this.memberIds(),
			meEmployeeId: this.meEmployeeId(),
			limit: CHAT_MENTION_SUGGESTIONS
		}).map((suggestion): MentionChoice => ({ kind: 'person', key: suggestion.person.employeeId, ...suggestion }));
		const needle = query.query.trim().toLowerCase();
		const everyone = this.everyone()
			? EVERYONE_MENTIONS.filter((item) => item.key.startsWith(needle)).map((item): MentionChoice => {
					const parts = matchParts(item.key, needle);
					return { kind: 'everyone', key: item.key, labelKey: item.labelKey, parts: { ...parts, before: `@${parts.before}` } };
				})
			: [];
		return [...people, ...everyone];
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
		this.marked.set([]);
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
			// At the very start there is no line before (lastIndexOf with -1 would find a leading newline at 0).
			const lineStart = start === 0 ? 0 : this.text.lastIndexOf('\n', start - 1) + 1;
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

	/**
	 * Opens or closes the emoji panel. Opened from the keyboard (a click with no pointer: `detail` 0), the focus moves
	 * to its first emoji, since the panel sits above the box, far behind the toggle in Tab order; a mouse keeps the box's focus.
	 */
	protected toggleEmoji(event: MouseEvent): void {
		const open = !this.emojiOpen();
		this.emojiOpen.set(open);
		if (open && event.detail === 0) this.afterRender(() => this.host.nativeElement.querySelector<HTMLElement>('.emoji-grid .emoji')?.focus());
	}

	/** Escape anywhere in the composer (the box, the emoji toggle, an emoji) closes the emoji panel and returns to the box. */
	protected onComposerEscape(event: Event): void {
		if (!this.emojiOpen()) return;
		event.preventDefault();
		this.emojiOpen.set(false);
		this.focus();
	}

	/** A press outside the composer closes its emoji panel. */
	protected onDocumentPress(event: MouseEvent): void {
		if (this.emojiOpen() && !this.host.nativeElement.contains(event.target as Node)) this.emojiOpen.set(false);
	}

	/** The body as the API would receive it, and its length (the one that counts). */
	private tokenized(): string {
		return namesToTokens(this.text.trim(), this.picked, this.channels);
	}

	private measure(): void {
		this.length.set(this.tokenized().length);
		const labels = [...[...this.picked.keys()].map((label) => `@${label}`), ...[...this.channels.keys()].map((label) => `#${label}`)];
		this.marked.set(markMentions(this.text, labels));
		this.afterRender(() => this.syncMirror());
	}

	/** Keeps the tinted layer scrolled with the box. */
	protected syncMirror(): void {
		const box = this.box()?.nativeElement;
		const mirror = this.mirror()?.nativeElement;
		if (box && mirror) mirror.scrollTop = box.scrollTop;
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
		// Keys that belong to an IME composition (Enter confirms it) neither pick a mention nor send.
		if (event.isComposing || event.keyCode === 229) return;
		const suggestions = this.suggestions();
		if (suggestions.length > 0) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const step = event.key === 'ArrowDown' ? 1 : -1;
				this.highlighted.set((this.highlighted() + step + suggestions.length) % suggestions.length);
				this.afterRender(() => this.revealHighlighted());
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
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.send();
		}
	}

	/** Scrolls the list so the row picked with the arrow keys stays in sight. */
	private revealHighlighted(): void {
		const row = this.host.nativeElement.querySelector(`.suggestion-list [data-index="${this.highlighted()}"]`);
		row?.scrollIntoView({ block: 'nearest' });
	}

	protected pick(choice: MentionChoice): void {
		const query = this.query();
		const element = this.box()?.nativeElement;
		if (!query || !element) return;
		const caret = element.selectionStart ?? this.text.length;
		let insertion: string;
		if (choice.kind === 'person') {
			const label = uniqueLabel(choice.person.name, choice.person.employeeId, this.picked);
			insertion = `@${label} `;
			this.picked.set(label, choice.person.employeeId);
		} else {
			insertion = `@${choice.key} `;
		}
		this.text = `${this.text.slice(0, query.start)}${insertion}${this.text.slice(caret)}`;
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
