// cspell:ignore safetxt
import { CHAT_MESSAGE_MAX_LENGTH, ChatAppBlockTypeEnum, IChatAppBlock } from '@gauzy/contracts';
import {
	assertPayloadSize,
	blocksOf,
	bodyText,
	ChatWebhookPayloadError,
	findButton,
	normalizeInteractionReply,
	normalizeWebhookPayload,
	payloadObjectOf,
	plainText
} from './chat-webhook-payload';

const EMPLOYEE = '7b1a3c0e-0000-4000-8000-000000000001';

function codeOf(run: () => unknown): string | null {
	try {
		run();
		return null;
	} catch (error) {
		return error instanceof ChatWebhookPayloadError ? error.code : `other: ${(error as Error).message}`;
	}
}

describe('chat webhook payloads', () => {
	describe('text', () => {
		it('posts a text payload as the body', () => {
			const content = normalizeWebhookPayload({ text: 'Build 412 passed' }, { canBroadcast: false });
			expect(content).toEqual({ body: 'Build 412 passed', blocks: [], nonce: null });
		});

		it('rewrites links, keeps mention tokens, drops HTML', () => {
			const body = bodyText(`Deploy <https://ci.example.com/412|#412> by <@${EMPLOYEE}> <b>done</b> <script>alert(1)</script>`, false);
			expect(body).toBe(`Deploy [#412](https://ci.example.com/412) by <@${EMPLOYEE}> done alert(1)`);
		});

		it('drops markup that arrived escaped, and keeps a plain comparison', () => {
			expect(bodyText('&lt;img src=x onerror=alert(1)&gt; 3 &lt; 4 &amp; 5 > 2', false)).toBe('3 < 4 & 5 > 2');
			expect(bodyText('a < b and c > d', false)).toBe('a < b and c > d');
		});

		it('honours @channel / @here only for a webhook allowed to broadcast', () => {
			expect(bodyText('<!channel> deploy <!here> <!everyone>', false)).toBe('@channel deploy @here @everyone');
			expect(bodyText('<!channel> deploy <!here> <!everyone>', true)).toBe('<!channel> deploy <!here> <!channel>');
		});

		it('never reads escaped angle brackets as a broadcast, in the body or in block text', () => {
			expect(bodyText('&lt;!here&gt; deploy &lt;!channel&gt;', false)).toBe('@here deploy @channel');
			// Escaped brackets are text even for a webhook allowed to broadcast: only its own `<!here>` counts.
			expect(bodyText('<!here> deploy &lt;!channel&gt;', true)).toBe('<!here> deploy @channel');
			expect(plainText('&lt;!here&gt; ping', 100)).toBe('@here ping');
			const content = normalizeWebhookPayload({ blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '&lt;!channel&gt; disk full' } }] }, { canBroadcast: false });
			expect(content.body).toBe('@channel disk full');
			expect(content.body).not.toMatch(/<!(channel|here)>/);
		});

		it('links a labelled target only when it is an https page of a public host, else keeps the label as text', () => {
			expect(bodyText('<https://status.example.com/|status> ok', false)).toBe('[status](https://status.example.com/) ok');
			expect(bodyText('<http://status.example.com/|status> ok', false)).toBe('status ok');
			expect(bodyText('<https://127.0.0.1/admin|status> ok', false)).toBe('status ok');
			expect(bodyText('<https://169.254.169.254/latest|meta> ok', false)).toBe('meta ok');
			expect(plainText('See <https://10.0.0.5/x|the run>', 100)).toBe('See the run');
			expect(plainText('See <https://x.example/a|the run>', 100)).toBe('See the run (https://x.example/a)');
		});

		it('reads the labels of foreign user and channel references', () => {
			expect(bodyText('<@U123|alice> in <#C9|ops> <!date^1700000000^{date}|Nov 14>', false)).toBe('@alice in #ops Nov 14');
		});

		it('drops control and bidi override characters', () => {
			expect(bodyText('safe\u202Etxt.exe\u0007', false)).toBe('safetxt.exe');
		});

		it('cuts a long text with an ellipsis instead of refusing it', () => {
			const content = normalizeWebhookPayload({ text: 'x'.repeat(CHAT_MESSAGE_MAX_LENGTH + 50) }, { canBroadcast: false });
			expect(content.body).toHaveLength(CHAT_MESSAGE_MAX_LENGTH);
			expect(content.body.endsWith('…')).toBe(true);
		});

		it('writes block text as plain text, links as "label (url)"', () => {
			expect(plainText('See <https://x.example/a|the run> <i>now</i>', 100)).toBe('See the run (https://x.example/a) now');
			expect(plainText('<!channel> ping', 100)).toBe('@channel ping');
		});
	});

	describe('blocks', () => {
		const monitoring = {
			text: 'CPU high on api-1',
			blocks: [
				{ type: 'header', text: { type: 'plain_text', text: 'CPU high' } },
				{ type: 'section', text: { type: 'mrkdwn', text: '*api-1* is at 97%' }, fields: [{ type: 'mrkdwn', text: '*Env*\nprod' }, { type: 'plain_text', text: 'Since 10:02' }] },
				{ type: 'divider' },
				{ type: 'context', elements: [{ type: 'mrkdwn', text: 'monitor 7' }, { type: 'image', image_url: 'https://x.example/i.png', alt_text: 'logo' }] },
				{
					type: 'actions',
					block_id: 'alert-7',
					elements: [
						{ type: 'button', action_id: 'ack', text: { type: 'plain_text', text: 'Acknowledge' }, value: 'alert-7', style: 'primary' },
						{ type: 'button', action_id: 'open', text: { type: 'plain_text', text: 'Open' }, url: 'https://monitor.example.com/7' },
						{ type: 'static_select', action_id: 'pick' }
					]
				}
			]
		};

		it('reads the documented subset: title, fields side by side, divider, context, buttons', () => {
			const content = normalizeWebhookPayload(monitoring, { canBroadcast: false });
			expect(content.body).toBe('CPU high on api-1');
			expect(content.blocks).toEqual<IChatAppBlock[]>([
				{ type: ChatAppBlockTypeEnum.HEADER, text: 'CPU high' },
				{ type: ChatAppBlockTypeEnum.SECTION, text: '*api-1* is at 97%', fields: ['*Env*\nprod', 'Since 10:02'] },
				{ type: ChatAppBlockTypeEnum.DIVIDER },
				{ type: ChatAppBlockTypeEnum.CONTEXT, elements: ['monitor 7', 'logo'] },
				{
					type: ChatAppBlockTypeEnum.ACTIONS,
					blockId: 'alert-7',
					elements: [
						{ actionId: 'ack', text: 'Acknowledge', value: 'alert-7', url: null, style: 'primary' },
						{ actionId: 'open', text: 'Open', value: null, url: 'https://monitor.example.com/7', style: null }
					]
				}
			]);
		});

		it('reads its own normalised shape back unchanged', () => {
			const first = normalizeWebhookPayload(monitoring, { canBroadcast: false });
			const again = normalizeWebhookPayload({ text: first.body, blocks: first.blocks }, { canBroadcast: false });
			expect(again.blocks).toEqual(first.blocks);
		});

		it('renders an unknown block type as its text, and drops one without text', () => {
			const content = normalizeWebhookPayload(
				{
					blocks: [
						{ type: 'rich_text', elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text: 'Hello' }, { type: 'text', text: 'world' }] }] },
						{ type: 'image', image_url: 'https://x.example/a.png', alt_text: 'A chart' },
						{ type: 'video' }
					]
				},
				{ canBroadcast: false }
			);
			expect(content.blocks).toEqual([
				{ type: ChatAppBlockTypeEnum.TEXT, text: 'Hello world' },
				{ type: ChatAppBlockTypeEnum.TEXT, text: 'A chart' }
			]);
			expect(content.body).toBe('Hello world\nA chart');
		});

		it('turns a section accessory button into an actions block', () => {
			const content = normalizeWebhookPayload(
				{ blocks: [{ type: 'section', block_id: 's1', text: 'Approve?', accessory: { type: 'button', action_id: 'yes', text: 'Approve' } }] },
				{ canBroadcast: false }
			);
			expect(content.blocks[1]).toEqual({ type: ChatAppBlockTypeEnum.ACTIONS, blockId: 's1', elements: [{ actionId: 'yes', text: 'Approve', value: null, url: null, style: null }] });
		});

		it('strips HTML out of block text', () => {
			const content = normalizeWebhookPayload({ blocks: [{ type: 'header', text: '<img src=x onerror=alert(1)>Deploy <b>ok</b>' }] }, { canBroadcast: false });
			expect(content.blocks).toEqual([{ type: ChatAppBlockTypeEnum.HEADER, text: 'Deploy ok' }]);
		});

		it('finds a stored button by action id, and by block id when given', () => {
			const { blocks } = normalizeWebhookPayload(monitoring, { canBroadcast: false });
			expect(findButton(blocks, 'ack')?.button.value).toBe('alert-7');
			expect(findButton(blocks, 'ack', 'alert-7')?.blockId).toBe('alert-7');
			expect(findButton(blocks, 'ack', 'other')).toBeNull();
			expect(findButton(blocks, 'nope')).toBeNull();
			expect(blocksOf(JSON.stringify(blocks))).toEqual(blocks);
			expect(blocksOf('not json')).toEqual([]);
		});
	});

	describe('legacy attachments', () => {
		it('reads pretext, author, title, text, fields, buttons and footer as blocks', () => {
			const content = normalizeWebhookPayload(
				{
					attachments: [
						{
							fallback: 'Deploy 412 to prod',
							pretext: 'New deploy',
							author_name: 'ci',
							title: 'Deploy 412',
							title_link: 'https://ci.example.com/412',
							text: 'All checks passed',
							fields: [{ title: 'Env', value: 'prod', short: true }],
							actions: [{ type: 'button', name: 'rollback', text: 'Roll back', value: '412' }],
							footer: 'ci bot'
						}
					]
				},
				{ canBroadcast: false }
			);
			expect(content.blocks).toEqual([
				{ type: ChatAppBlockTypeEnum.SECTION, text: 'New deploy', fields: null },
				{ type: ChatAppBlockTypeEnum.CONTEXT, elements: ['ci'] },
				{ type: ChatAppBlockTypeEnum.HEADER, text: 'Deploy 412 (https://ci.example.com/412)' },
				{ type: ChatAppBlockTypeEnum.SECTION, text: 'All checks passed', fields: ['Env\nprod'] },
				{ type: ChatAppBlockTypeEnum.ACTIONS, blockId: '_block-4', elements: [{ actionId: 'rollback', text: 'Roll back', value: '412', url: null, style: null }] },
				{ type: ChatAppBlockTypeEnum.CONTEXT, elements: ['ci bot'] }
			]);
			expect(content.body.startsWith('New deploy')).toBe(true);
		});

		it('tells apart two attachments whose buttons share a name: each actions block gets its own id', () => {
			const content = normalizeWebhookPayload(
				{
					text: 'Two deploys',
					attachments: [
						{ text: 'api', actions: [{ type: 'button', name: 'rollback', text: 'Roll back', value: 'api' }] },
						{ text: 'web', actions: [{ type: 'button', name: 'rollback', text: 'Roll back', value: 'web' }] }
					]
				},
				{ canBroadcast: false }
			);
			const ids = content.blocks.filter((block) => block.type === ChatAppBlockTypeEnum.ACTIONS).map((block) => (block as { blockId: string }).blockId);
			expect(ids).toEqual(['_block-1', '_block-3']);
			expect(findButton(content.blocks, 'rollback', '_block-3')?.button.value).toBe('web');
			// Without its block the click could mean either button: it names none.
			expect(findButton(content.blocks, 'rollback')).toBeNull();
		});

		it('never hands out a block id the payload named, and keeps generated action ids short', () => {
			const content = normalizeWebhookPayload(
				{
					text: 'x',
					blocks: [
						{ type: 'actions', block_id: '_block-1', elements: [{ type: 'button', action_id: 'go', text: 'One' }] },
						{ type: 'actions', elements: [{ type: 'button', action_id: 'go', text: 'Two' }, { type: 'button', text: 'Three' }] },
						{ type: 'actions', block_id: 'b'.repeat(255), elements: [{ type: 'button', text: 'Four' }] }
					]
				},
				{ canBroadcast: false }
			);
			const actions = content.blocks as Array<{ blockId: string; elements: Array<{ actionId: string }> }>;
			expect(actions.map((block) => block.blockId)).toEqual(['_block-1', '_block-1-1', 'b'.repeat(255)]);
			expect(actions[1].elements.map((button) => button.actionId)).toEqual(['go', '_action-1']);
			expect(actions[2].elements[0].actionId).toBe('_action-0');
			expect(findButton(content.blocks, 'go', '_block-1-1')?.button.text).toBe('Two');
		});

		it('never generates an action id a button of the row named', () => {
			const content = normalizeWebhookPayload(
				{ text: 'x', blocks: [{ type: 'actions', block_id: 'b', elements: [{ type: 'button', action_id: '_action-1', text: 'One' }, { type: 'button', text: 'Two' }] }] },
				{ canBroadcast: false }
			);
			const [row] = content.blocks as Array<{ elements: Array<{ actionId: string }> }>;
			expect(row.elements.map((button) => button.actionId)).toEqual(['_action-1', '_action-1-1']);
		});

		it('keeps generated action ids unique across rows that share a block id', () => {
			const content = normalizeWebhookPayload(
				{
					text: 'x',
					blocks: [
						{ type: 'actions', block_id: 'b', elements: [{ type: 'button', text: 'One' }] },
						{ type: 'actions', block_id: 'b', elements: [{ type: 'static_select' }, { type: 'button', text: 'Two' }] }
					]
				},
				{ canBroadcast: false }
			);
			const ids = (content.blocks as Array<{ elements: Array<{ actionId: string }> }>).flatMap((row) => row.elements.map((button) => button.actionId));
			expect(ids).toEqual(['_action-0', '_action-0-1']);
			// Two buttons that name the same id in rows of the same block id still cannot be told apart.
			const twins = [
				{ type: 'actions', block_id: 'b', elements: [{ type: 'button', action_id: 'go', text: 'One' }] },
				{ type: 'actions', block_id: 'b', elements: [{ type: 'button', action_id: 'go', text: 'Two' }] }
			];
			expect(codeOf(() => normalizeWebhookPayload({ text: 'x', blocks: twins }, { canBroadcast: false }))).toBe('invalid_blocks');
		});

		it('tells apart ids that a delimiter would run together', () => {
			const blocks = [
				{ type: 'actions', block_id: 'a::b', elements: [{ type: 'button', action_id: 'c', text: 'One' }] },
				{ type: 'actions', block_id: 'a', elements: [{ type: 'button', action_id: 'b::c', text: 'Two' }] }
			];
			expect(codeOf(() => normalizeWebhookPayload({ text: 'x', blocks }, { canBroadcast: false }))).toBeNull();
		});

		it('falls back to the attachment fallback for the body when nothing else has text', () => {
			const content = normalizeWebhookPayload({ attachments: [{ fallback: 'Only a fallback', color: '#f00' }] }, { canBroadcast: false });
			expect(content).toEqual({ body: 'Only a fallback', blocks: [], nonce: null });
		});
	});

	describe('limits and refusals (422)', () => {
		it('refuses a body over 64 KiB', () => {
			expect(codeOf(() => assertPayloadSize(64 * 1024))).toBeNull();
			expect(codeOf(() => assertPayloadSize(64 * 1024 + 1))).toBe('payload_too_large');
		});

		it('refuses more than 50 blocks, attachments included', () => {
			const divider = { type: 'divider' };
			expect(codeOf(() => normalizeWebhookPayload({ text: 'x', blocks: Array(50).fill(divider) }, { canBroadcast: false }))).toBeNull();
			expect(codeOf(() => normalizeWebhookPayload({ text: 'x', blocks: Array(51).fill(divider) }, { canBroadcast: false }))).toBe('too_many_blocks');
			expect(
				codeOf(() => normalizeWebhookPayload({ text: 'x', blocks: Array(45).fill(divider), attachments: [{ blocks: Array(6).fill(divider) }] }, { canBroadcast: false }))
			).toBe('too_many_blocks');
		});

		it('refuses too many fields or buttons, duplicate action ids and unsafe button links', () => {
			const fields = Array(11).fill({ type: 'plain_text', text: 'f' });
			expect(codeOf(() => normalizeWebhookPayload({ blocks: [{ type: 'section', text: 'x', fields }] }, { canBroadcast: false }))).toBe('invalid_blocks');
			const buttons = Array.from({ length: 11 }, (_, i) => ({ type: 'button', action_id: `a${i}`, text: 'b' }));
			expect(codeOf(() => normalizeWebhookPayload({ text: 'x', blocks: [{ type: 'actions', elements: buttons }] }, { canBroadcast: false }))).toBe('invalid_blocks');
			const twins = [{ type: 'button', action_id: 'a', text: 'one' }, { type: 'button', action_id: 'a', text: 'two' }];
			expect(codeOf(() => normalizeWebhookPayload({ text: 'x', blocks: [{ type: 'actions', elements: twins }] }, { canBroadcast: false }))).toBe('invalid_blocks');
			for (const url of ['http://example.com', 'https://127.0.0.1/x', 'https://169.254.169.254/latest', 'javascript:alert(1)', 'https://[::1]/']) {
				const blocks = [{ type: 'actions', elements: [{ type: 'button', action_id: 'a', text: 'go', url }] }];
				expect(codeOf(() => normalizeWebhookPayload({ text: 'x', blocks }, { canBroadcast: false }))).toBe('invalid_blocks');
			}
		});

		it('gives a button whose action id is only control characters a generated one, and drops such a block id', () => {
			const { blocks } = normalizeWebhookPayload(
				{ text: 'x', blocks: [{ type: 'actions', block_id: '\u0000\u0007', elements: [{ type: 'button', action_id: '\u0000\u0001', text: 'Go' }] }] },
				{ canBroadcast: false }
			);
			const actions = blocks[0] as { blockId?: string; elements: Array<{ actionId: string }> };
			expect(actions.elements[0].actionId).not.toBe('');
			expect(actions.elements[0].actionId).toMatch(/^[\w-]+$/);
			expect(actions.blockId).toBe('_block-0');
		});

		it('refuses a payload with no text at all, and wrong types', () => {
			expect(codeOf(() => normalizeWebhookPayload({}, { canBroadcast: false }))).toBe('no_text');
			expect(codeOf(() => normalizeWebhookPayload({ text: '   ', blocks: [{ type: 'divider' }] }, { canBroadcast: false }))).toBe('no_text');
			expect(codeOf(() => normalizeWebhookPayload({ text: 42 }, { canBroadcast: false }))).toBe('invalid_payload');
			expect(codeOf(() => normalizeWebhookPayload({ blocks: {} }, { canBroadcast: false }))).toBe('invalid_payload');
			expect(codeOf(() => payloadObjectOf('text'))).toBe('invalid_payload');
			expect(codeOf(() => payloadObjectOf([1, 2]))).toBe('invalid_payload');
			expect(codeOf(() => payloadObjectOf({ payload: '{nope' }))).toBe('invalid_payload');
		});

		it('reads the form flavour: one payload field holding the JSON', () => {
			expect(payloadObjectOf({ payload: '{"text":"hi"}' })).toEqual({ text: 'hi' });
		});

		it('reads a form body whose payload field sits beside other fields, and never unwraps a post of its own', () => {
			expect(payloadObjectOf({ payload: '{"text":"hi"}', source: 'ci' })).toEqual({ text: 'hi' });
			// A JSON post that carries content keeps it, whatever string `payload` it also holds.
			expect(payloadObjectOf({ text: 'keep', payload: '{"text":"other"}' })).toEqual({ text: 'keep', payload: '{"text":"other"}' });
			expect(payloadObjectOf({ blocks: [], payload: 'x' })).toEqual({ blocks: [], payload: 'x' });
		});
	});

	describe('idempotency', () => {
		it('takes the nonce from the payload, else from the Idempotency-Key header', () => {
			expect(normalizeWebhookPayload({ text: 'x', nonce: 'n-1' }, { canBroadcast: false, idempotencyKey: 'h-1' }).nonce).toBe('n-1');
			expect(normalizeWebhookPayload({ text: 'x' }, { canBroadcast: false, idempotencyKey: 'h-1' }).nonce).toBe('h-1');
			expect(codeOf(() => normalizeWebhookPayload({ text: 'x', nonce: 'n'.repeat(65) }, { canBroadcast: false }))).toBe('invalid_payload');
		});
	});

	describe('interaction replies', () => {
		it('reads a reply with content, ignores one that asks for nothing', () => {
			expect(normalizeInteractionReply({ text: 'Acknowledged by Ana', blocks: [{ type: 'context', elements: ['done'] }] }, { canBroadcast: false })).toEqual({
				body: 'Acknowledged by Ana',
				blocks: [{ type: ChatAppBlockTypeEnum.CONTEXT, elements: ['done'] }],
				nonce: null
			});
			expect(normalizeInteractionReply({ ok: true }, { canBroadcast: false })).toBeNull();
			expect(normalizeInteractionReply({ text: 'x', replace_original: false }, { canBroadcast: false })).toBeNull();
			expect(normalizeInteractionReply('ok', { canBroadcast: false })).toBeNull();
		});
	});
});
