import { Injector } from '@angular/core';
import { PluginKey } from '@tiptap/pm/state';
import { mergeAttributes } from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import { firstValueFrom } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { EmployeesService, Store } from '@gauzy/ui-core/core';
import { SuggestionHostService } from './suggestion-host.service';
import { ISuggestionItem } from './suggestion-list.component';

export interface IMentionAttrs {
	id: string;
	label: string;
}

const DEBOUNCE_MS = 250;
const LIMIT = 10;

/**
 * Employee mentions (`@`) — spec 05 §7.1. Org-scoped employee lookup through the
 * existing `EmployeesService` (org list cached per editor session, filtered
 * locally; 250 ms debounce + in-flight sequence guard so stale responses never
 * render). The editor never calls a notification API — ids collected from the
 * doc are sent as `mentionEmployeeIds` on every content save.
 */
export function createEmployeeMention(injector: Injector, host: SuggestionHostService) {
	const employeesService = injector.get(EmployeesService);
	const store = injector.get(Store);

	let cache: IEmployee[] | null = null;
	let sequence = 0;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const loadEmployees = async (): Promise<IEmployee[]> => {
		if (cache) return cache;
		const { id: organizationId, tenantId } = store.selectedOrganization ?? ({} as never);
		const { items } = await firstValueFrom(
			employeesService.getAll(['user'], { organizationId, tenantId } as never)
		);
		cache = items ?? [];
		return cache;
	};

	const toItem = (employee: IEmployee): ISuggestionItem<IMentionAttrs> => {
		const label =
			employee.fullName ||
			[employee.user?.firstName, employee.user?.lastName].filter(Boolean).join(' ') ||
			employee.user?.email ||
			'';
		return { id: String(employee.id), label, icon: 'person-outline', data: { id: String(employee.id), label } };
	};

	return Mention.extend({ name: 'employeeMention' }).configure({
		HTMLAttributes: { class: 'gz-employee-mention', 'data-type': 'employee-mention' },
		renderText: ({ node }) => `@${node.attrs['label'] ?? node.attrs['id']}`,
		renderHTML: ({ options, node }) => [
			'span',
			mergeAttributes(options.HTMLAttributes, { 'data-id': node.attrs['id'] }),
			`@${node.attrs['label'] ?? node.attrs['id']}`
		],
		suggestion: {
			char: '@',
			pluginKey: new PluginKey('gzEmployeeMention'),
			items: ({ query }) =>
				new Promise<ISuggestionItem<IMentionAttrs>[]>((resolve) => {
					if (debounceTimer) clearTimeout(debounceTimer);
					const mySequence = ++sequence;
					debounceTimer = setTimeout(async () => {
						try {
							const employees = await loadEmployees();
							if (mySequence !== sequence) return resolve([]);
							const normalized = (query ?? '').trim().toLowerCase();
							resolve(
								employees
									.map(toItem)
									.filter((item) => !normalized || item.label.toLowerCase().includes(normalized))
									.slice(0, LIMIT)
							);
						} catch {
							resolve([]);
						}
					}, DEBOUNCE_MS);
				}),
			command: ({ editor, range, props }) => {
				const item = props as unknown as ISuggestionItem<IMentionAttrs>;
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.insertContent([
						{ type: 'employeeMention', attrs: item.data },
						{ type: 'text', text: ' ' }
					])
					.run();
			},
			render: () => ({
				onStart: (props) => host.open(props as never, 'DOCS.EDITOR.MENTION_ARIA_LABEL'),
				onUpdate: (props) => host.update(props as never, 'DOCS.EDITOR.MENTION_ARIA_LABEL'),
				onKeyDown: ({ event }) => host.onKeyDown(event),
				onExit: () => host.close()
			})
		}
	});
}

/** Walks a TipTap JSON doc collecting distinct employee-mention ids (save DTO contract, spec 05 §7.1). */
export function collectEmployeeMentionIds(contentJson: unknown): string[] {
	const ids = new Set<string>();
	const walk = (node: unknown): void => {
		if (!node || typeof node !== 'object') return;
		const typed = node as { type?: string; attrs?: { id?: string }; content?: unknown[] };
		if (typed.type === 'employeeMention' && typed.attrs?.id) ids.add(String(typed.attrs.id));
		typed.content?.forEach(walk);
	};
	walk(contentJson);
	return [...ids];
}
