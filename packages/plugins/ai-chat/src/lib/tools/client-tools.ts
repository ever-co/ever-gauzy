import { z } from 'zod';
import type { Tool } from 'ai';
import { loadAiSdk } from '../esm-loader';

/**
 * Client-executed tools — declared on the server (so the model can call
 * them) but WITHOUT `execute`: the AI SDK forwards the calls to the
 * browser, where the chat panel runs them against the Angular app
 * (router navigation, DOM form bridge) and streams the results back.
 *
 * `submit_form` and other mutating actions additionally require the
 * user's explicit approval (see `toolApproval` in the chat service).
 */
export async function buildClientTools(): Promise<Record<string, Tool>> {
	const { tool } = await loadAiSdk();

	return {
		list_pages: tool({
			description:
				'List the Gauzy platform pages the current user can open in the canvas (main content area). ' +
				'Returns page paths, titles and descriptions. Use before open_page when unsure of a path.',
			inputSchema: z.object({})
		}),

		open_page: tool({
			description:
				'Open a Gauzy platform page in the canvas (the main content area next to this chat). ' +
				'Use list_pages to discover valid paths. Only in-app absolute paths are allowed.',
			inputSchema: z.object({
				path: z.string().describe("Absolute in-app route, e.g. '/pages/tasks/dashboard'"),
				queryParams: z.record(z.string(), z.string()).optional().describe('Optional query parameters')
			})
		}),

		read_page: tool({
			description:
				'Read the page currently open in the canvas: its URL, title, and every visible form with ' +
				'its fields (labels, types, current values, options). Always call this before fill_form.',
			inputSchema: z.object({})
		}),

		fill_form: tool({
			description:
				'Fill fields of a form on the page currently open in the canvas. Field names must come from ' +
				'read_page. Returns which fields were filled and which failed (with reasons). Does NOT submit.',
			inputSchema: z.object({
				fields: z
					.array(
						z.object({
							field: z.string().describe('Field label or name as reported by read_page'),
							value: z
								.string()
								.describe("Value to set. Checkboxes: 'true'/'false'. Selects: the option label.")
						})
					)
					.min(1),
				formIndex: z.number().int().optional().describe('Form index from read_page (when multiple forms)')
			})
		}),

		submit_form: tool({
			description:
				'Submit the form on the page currently open in the canvas by clicking its submit button. ' +
				'Requires explicit user approval. Fill and verify the form first.',
			inputSchema: z.object({
				formIndex: z.number().int().optional().describe('Form index from read_page (when multiple forms)')
			})
		})
	};
}

/** Names of client tools that must never run without user approval. */
export const CLIENT_TOOLS_REQUIRING_APPROVAL = ['submit_form'] as const;
