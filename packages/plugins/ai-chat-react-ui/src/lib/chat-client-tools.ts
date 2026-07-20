import type { Injector } from '@angular/core';
import { AgentFormBridgeService, AgentPageBridgeService } from '@gauzy/ui-core/core';

/** Tool names executed in the browser (declared server-side without `execute`). */
export const CLIENT_TOOL_NAMES = ['list_pages', 'open_page', 'read_page', 'fill_form', 'submit_form'] as const;

export type ClientToolName = (typeof CLIENT_TOOL_NAMES)[number];

export function isClientTool(toolName: string): toolName is ClientToolName {
	return (CLIENT_TOOL_NAMES as readonly string[]).includes(toolName);
}

/**
 * Execute a client-side ("canvas") tool call in the browser.
 *
 * These tools drive the Angular app next to the chat: opening pages via
 * the router and reading / filling / submitting the forms of whatever
 * page is on screen. The heavy lifting lives in `AgentPageBridgeService`
 * and `AgentFormBridgeService` (@gauzy/ui-core), reached through the
 * Angular injector provided by the React bridge.
 *
 * Returns the tool output to stream back to the model. Throws are caught
 * by the caller and reported as tool errors.
 */
export async function executeClientTool(injector: Injector, toolName: string, input: any): Promise<unknown> {
	switch (toolName as ClientToolName) {
		case 'list_pages': {
			const pages = await injector.get(AgentPageBridgeService).listPages();
			return { pages };
		}
		case 'open_page': {
			return injector.get(AgentPageBridgeService).openPage(input?.path, input?.queryParams);
		}
		case 'read_page': {
			return injector.get(AgentFormBridgeService).readPage();
		}
		case 'fill_form': {
			return injector.get(AgentFormBridgeService).fillForm(input?.fields ?? [], input?.formIndex);
		}
		case 'submit_form': {
			return injector.get(AgentFormBridgeService).submitForm(input?.formIndex);
		}
		default:
			throw new Error(`Unknown client tool '${toolName}'.`);
	}
}
