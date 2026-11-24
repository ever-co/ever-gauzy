/**
 * Every tool the server registers declares its hints, and a client reading them is never told that a deletion, a
 * refund or a send is harmless, nor asked about a read. The collaboration groups are enabled so their tools are walked
 * too.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../mcp-server';
import { COLLABORATION_TOOLS } from './collaboration/scopes';

/** A word of the name (between underscores) that says the call removes, settles or sends something. */
const DESTRUCTIVE_WORDS = new Set([
	'delete',
	'refund',
	'send',
	'approve',
	'deny',
	'archive',
	'remove',
	'unassign',
	'invite',
	'process'
]);
const READ_PREFIX = /^(get|list|count|search)_/;
/** `update_candidate_status` rejects through the route that emails the candidate their rejection. */
const SENDS_OUTSIDE = ['invite_organization_contact', 'send_invoice_email', 'update_candidate_status'];
/** A start or a stop of the timer ends the run going and cuts the entries that run overlaps. */
const ENDS_THE_RUN_GOING = ['start_timer', 'stop_timer'];
/** Tools that read a record and write it back whole: what changed in between is written over. */
const READ_THEN_REPLACE = [
	'add_pipeline_stage',
	'assign_employees_to_time_off_policy',
	'assign_skill_to_employee',
	'assign_task_to_employee',
	'bulk_update_tasks',
	'remove_pipeline_stage',
	'remove_skill_from_employee',
	'unassign_task_from_employee',
	'update_pipeline_stage',
	'update_time_off_policy'
];

const wordsOf = (name: string) => name.split('_');
const saysDestructive = (name: string) => wordsOf(name).some((word) => DESTRUCTIVE_WORDS.has(word));
const isDestructive = (tool: Tool) => tool.annotations?.destructiveHint === true;

/** The names of the tools whose hints fail `check`. */
const failing = (tools: Tool[], check: (tool: Tool) => boolean) =>
	tools.filter((tool) => !check(tool)).map((tool) => tool.name);

/** The tools of these names. */
const named = (tools: Tool[], names: string[]) => tools.filter((tool) => names.includes(tool.name));

/** Whether each hint a client reads for the tool is stated, the write hints wherever the tool writes. */
function declaresItsHints({ annotations }: Tool): boolean {
	if (!annotations) {
		return false;
	}
	const readHintsStated =
		typeof annotations.readOnlyHint === 'boolean' && typeof annotations.openWorldHint === 'boolean';
	if (!readHintsStated) {
		return false;
	}
	if (annotations.readOnlyHint) {
		return true;
	}
	return typeof annotations.destructiveHint === 'boolean' && typeof annotations.idempotentHint === 'boolean';
}

describe('the hints every registered tool declares', () => {
	const saved = { ...process.env };
	let tools: Tool[] = [];

	beforeAll(async () => {
		Object.assign(process.env, {
			GAUZY_MCP_TOOLS_CHAT: 'true',
			GAUZY_MCP_TOOLS_DOCS: 'true',
			GAUZY_MCP_TOOLS_INBOX: 'true'
		});
		delete process.env['GAUZY_MCP_TOOLS_SCOPES'];
		const { server } = createMcpServer();
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		const client = new Client({ name: 'tool-hints-spec', version: '0.0.0' });
		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
		try {
			tools = (await client.listTools()).tools;
		} finally {
			await client.close();
			await server.close();
		}
	});

	afterAll(() => {
		process.env = { ...saved };
	});

	it('walks every tool, the collaboration ones included', () => {
		const names = tools.map((tool) => tool.name);

		expect(names.length).toBeGreaterThanOrEqual(330);
		expect(names).toEqual(expect.arrayContaining(Object.keys(COLLABORATION_TOOLS)));
	});

	it('finds the hints of every tool stated', () => {
		expect(failing(tools, declaresItsHints)).toEqual([]);
	});

	it('marks destructive every tool whose name says it deletes, refunds, sends, approves, denies or archives', () => {
		const destructiveByName = tools.filter((tool) => saysDestructive(tool.name));

		expect(destructiveByName.length).toBeGreaterThan(30);
		expect(failing(destructiveByName, (tool) => tool.annotations?.destructiveHint === true)).toEqual([]);
		expect(failing(destructiveByName, (tool) => tool.annotations?.readOnlyHint === false)).toEqual([]);
	});

	it('marks destructive the start and the stop of the timer, which end the run going', () => {
		const timer = named(tools, ENDS_THE_RUN_GOING);

		expect(timer).toHaveLength(ENDS_THE_RUN_GOING.length);
		expect(failing(timer, isDestructive)).toEqual([]);
	});

	it('marks destructive every tool that reads a record and writes it back whole', () => {
		const replacing = named(tools, READ_THEN_REPLACE);

		expect(replacing).toHaveLength(READ_THEN_REPLACE.length);
		expect(failing(replacing, isDestructive)).toEqual([]);
	});

	it('marks destructive a key result update, which moves its key result and goal to the value it reports', () => {
		const reports = named(tools, ['create_key_result_update']);

		expect(reports).toHaveLength(1);
		expect(failing(reports, isDestructive)).toEqual([]);
	});

	it('does not hint idempotent the chat read, which reads up to the newest message when it names none', () => {
		const [markRead] = named(tools, ['mark_chat_conversation_read']);

		expect(markRead?.annotations).toEqual(expect.objectContaining({ idempotentHint: false, readOnlyHint: false }));
	});

	it('marks read-only every get, list, count and search tool', () => {
		const reads = tools.filter((tool) => READ_PREFIX.test(tool.name));

		expect(reads.length).toBeGreaterThan(150);
		expect(failing(reads, (tool) => tool.annotations?.readOnlyHint === true)).toEqual([]);
	});

	it('marks open world only the tools that send to an address outside the workspace', () => {
		const openWorld = tools.filter((tool) => tool.annotations?.openWorldHint === true).map((tool) => tool.name);

		expect(openWorld.sort()).toEqual(SENDS_OUTSIDE);
	});
});
