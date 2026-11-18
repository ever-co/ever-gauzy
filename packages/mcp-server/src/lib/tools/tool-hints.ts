import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/**
 * The hints the tools declare, by the effect a call has. A client reads them to decide whether to ask the person
 * before a call: a destructive tool is asked about, a read-only one is not. Hints say nothing a call enforces.
 *
 * `openWorldHint` is false wherever a tool reaches only the workspace through the platform API, and true for a tool
 * that sends to an address outside it.
 */
export const TOOL_HINTS = Object.freeze({
	/** Reads: the workspace is left as it was. */
	readOnly: Object.freeze<ToolAnnotations>({ readOnlyHint: true, openWorldHint: false }),
	/** Writes that keep what exists: a creation, an addition to a list, a timer started or stopped. */
	write: Object.freeze<ToolAnnotations>({
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: false,
		openWorldHint: false
	}),
	/** Writes that keep what exists, a second call with the same arguments changing nothing more: a restore. */
	idempotentWrite: Object.freeze<ToolAnnotations>({
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false
	}),
	/** Writes that replace or settle what exists: an update, an approval, a payment processed or refunded. */
	destructive: Object.freeze<ToolAnnotations>({
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false
	}),
	/** Removals by id: what they remove is gone, and a second call removes nothing more. */
	idempotentDestructive: Object.freeze<ToolAnnotations>({
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: true,
		openWorldHint: false
	}),
	/** Sends to an address outside the workspace: a message cannot be taken back, and each call sends again. */
	openWorldDestructive: Object.freeze<ToolAnnotations>({
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true
	})
});
