import { CHAT_MESSAGE_MAX_LENGTH, ChatAppBlockTypeEnum, ChatInteractionStatusEnum, ChatMessageKindEnum, IChatAppBlock } from '@gauzy/contracts';
import {
	APP_INTERACTION_RETRY_DELAYS_MS,
	APP_INTERACTION_TIMEOUT_MS,
	appBlocksOf,
	blocksBody,
	blocksText,
	bodyRepeatsBlocks,
	buttonKey,
	buttonStateOf,
	isUnansweredClick,
	keepsClickKey,
	safeButtonUrl,
	safeIconUrl
} from './chat-app-blocks';

const BLOCKS: IChatAppBlock[] = [
	{ type: ChatAppBlockTypeEnum.HEADER, text: 'CPU high' },
	{ type: ChatAppBlockTypeEnum.SECTION, text: 'api-1 at 97%', fields: ['Env\nprod', 'Since 10:02'] },
	{ type: ChatAppBlockTypeEnum.DIVIDER },
	{ type: ChatAppBlockTypeEnum.CONTEXT, elements: ['monitor 7', 'eu-west'] },
	{ type: ChatAppBlockTypeEnum.ACTIONS, blockId: 'a', elements: [{ actionId: 'ack', text: 'Acknowledge' }] }
];

describe('chat app blocks', () => {
	it('reads the blocks of an app message only, and skips types it does not know', () => {
		const blocks = [...BLOCKS, { type: 'video' } as unknown as IChatAppBlock, null as unknown as IChatAppBlock];
		expect(appBlocksOf({ kind: ChatMessageKindEnum.APP, blocks })).toEqual(BLOCKS);
		expect(appBlocksOf({ kind: ChatMessageKindEnum.MESSAGE, blocks })).toEqual([]);
		expect(appBlocksOf({ kind: ChatMessageKindEnum.APP, blocks: null })).toEqual([]);
		expect(appBlocksOf(null)).toEqual([]);
	});

	it('knows a body that only repeats the blocks (the API derived it from them)', () => {
		expect(blocksText(BLOCKS)).toBe('CPU high\napi-1 at 97%\nEnv\nprod\nSince 10:02\nmonitor 7 · eu-west');
		expect(bodyRepeatsBlocks('CPU high\napi-1 at 97%\nEnv\nprod\nSince 10:02\nmonitor 7 · eu-west', BLOCKS)).toBe(true);
		expect(bodyRepeatsBlocks('CPU high on api-1', BLOCKS)).toBe(false);
		expect(bodyRepeatsBlocks('anything', [])).toBe(false);
	});

	it('knows a long blocks-only body the API cut to the message length, with its ellipsis', () => {
		const long: IChatAppBlock[] = [
			{ type: ChatAppBlockTypeEnum.HEADER, text: 'Nightly report' },
			{ type: ChatAppBlockTypeEnum.SECTION, text: 'x '.repeat(1500).trim() },
			{ type: ChatAppBlockTypeEnum.SECTION, text: 'y '.repeat(1500).trim() }
		];
		const text = blocksText(long);
		expect(text.length).toBeGreaterThan(CHAT_MESSAGE_MAX_LENGTH);
		const body = `${text.slice(0, CHAT_MESSAGE_MAX_LENGTH - 1).trimEnd()}…`;
		expect(blocksBody(long)).toBe(body);
		expect(body.length).toBeLessThanOrEqual(CHAT_MESSAGE_MAX_LENGTH);
		expect(bodyRepeatsBlocks(body, long)).toBe(true);
		expect(bodyRepeatsBlocks(text, long)).toBe(false);
		expect(blocksBody(BLOCKS)).toBe(blocksText(BLOCKS));
	});

	it('opens https links only', () => {
		expect(safeButtonUrl({ url: 'https://monitor.example.com/7' })).toBe('https://monitor.example.com/7');
		expect(safeButtonUrl({ url: 'http://monitor.example.com/7' })).toBeNull();
		expect(safeButtonUrl({ url: 'javascript:alert(1)' })).toBeNull();
		expect(safeButtonUrl({ url: 'not a url' })).toBeNull();
		expect(safeButtonUrl({ url: null })).toBeNull();
		expect(safeIconUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
		expect(safeIconUrl('data:image/png;base64,AAAA')).toBeNull();
	});

	it('keys a button by its block and action, and maps interaction states to button states', () => {
		expect(buttonKey('a', 'ack')).not.toBe(buttonKey('b', 'ack'));
		expect(buttonKey(null, 'ack')).toBe(buttonKey(undefined, 'ack'));
		expect(buttonStateOf(ChatInteractionStatusEnum.DELIVERED)).toBe('done');
		expect(buttonStateOf(ChatInteractionStatusEnum.FAILED)).toBe('failed');
		expect(buttonStateOf(ChatInteractionStatusEnum.RETRYING)).toBe('pending');
		expect(buttonStateOf(ChatInteractionStatusEnum.PENDING)).toBe('pending');
	});

	it('sends a click again only when it got no answer that settles it, twice', () => {
		for (const status of [0, undefined, null, 408, 429, 502, 503, 504]) expect(isUnansweredClick(status)).toBe(true);
		for (const status of [200, 400, 401, 403, 404, 409, 500]) expect(isUnansweredClick(status)).toBe(false);
		expect(APP_INTERACTION_RETRY_DELAYS_MS).toEqual([1000, 3000]);
		expect(APP_INTERACTION_TIMEOUT_MS).toBe(15_000);
	});

	it('keeps a click’s key after no answer or a server error, and lets a refusal settle it', () => {
		for (const status of [0, undefined, 408, 429, 500, 502, 503, 504]) expect(keepsClickKey(status)).toBe(true);
		for (const status of [400, 401, 403, 404, 409, 422]) expect(keepsClickKey(status)).toBe(false);
	});
});
