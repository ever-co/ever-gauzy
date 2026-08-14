import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { TranslateService } from '@ngx-translate/core';
import { SuggestionHostService } from './suggestion-host.service';
import { ISuggestionItem } from './suggestion-list.component';
import { ISlashCommand, ISlashCommandDeps, filterSlashCommands } from './slash-menu.items';

export interface ISlashCommandExtensionDeps {
	host: SuggestionHostService;
	translate: TranslateService;
	commandDeps: ISlashCommandDeps;
}

export const slashSuggestionPluginKey = new PluginKey('gzSlashCommand');

type SlashItem = ISuggestionItem<{ command: ISlashCommand; deps: ISlashCommandDeps }>;

/**
 * Slash-command menu: `@tiptap/suggestion` with char `/` rendered through the
 * shared `SuggestionHostService` popup (spec 05 §6.4). Backspacing past the `/`
 * closes the menu (built into the suggestion plugin).
 */
export function createSlashCommandExtension(deps: ISlashCommandExtensionDeps) {
	return Extension.create({
		name: 'slashCommand',

		addProseMirrorPlugins() {
			return [
				Suggestion<SlashItem>({
					editor: this.editor,
					pluginKey: slashSuggestionPluginKey,
					char: '/',
					startOfLine: false,
					allowSpaces: false,
					items: ({ query }) => filterSlashCommands(query, deps.translate, deps.commandDeps),
					command: ({ editor, range, props }) => {
						props.data.command.action(editor, range, props.data.deps);
					},
					render: () => ({
						onStart: (props) => deps.host.open(props as never, 'DOCS.EDITOR.SLASH.ARIA_LABEL'),
						onUpdate: (props) => deps.host.update(props as never, 'DOCS.EDITOR.SLASH.ARIA_LABEL'),
						onKeyDown: ({ event }) => deps.host.onKeyDown(event),
						onExit: () => deps.host.close()
					})
				})
			];
		}
	});
}
