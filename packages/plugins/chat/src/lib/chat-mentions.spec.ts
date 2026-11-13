import { mentionedEmployees, messageExcerpt, parseMentions, plainExcerpt } from './chat-mentions';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('parseMentions', () => {
	it('reads employee, conversation and broadcast tokens once each', () => {
		const mentions = parseMentions(`hi <@${A}> and <@${A}> see <#${B}> <!channel> <!here>`);
		expect(mentions).toEqual({ employeeIds: [A], conversationIds: [B], channel: true, here: true });
	});

	it('ignores tokens inside code', () => {
		expect(parseMentions(`\`<@${A}>\` and \`\`\`\n<!channel>\n\`\`\` but <@${B}>`)).toEqual({
			employeeIds: [B],
			conversationIds: [],
			channel: false,
			here: false
		});
	});

	it('reads nothing from an empty body', () => {
		expect(parseMentions('')).toEqual({ employeeIds: [], conversationIds: [], channel: false, here: false });
		expect(parseMentions(undefined)).toEqual({ employeeIds: [], conversationIds: [], channel: false, here: false });
	});
});

describe('mentionedEmployees', () => {
	it('keeps members only, merges the hint, and never the author', () => {
		expect(mentionedEmployees(`<@${A}> <@${C}>`, [B, A], [A, B], A)).toEqual([B]);
		expect(mentionedEmployees(`<@${A}>`, undefined, [A, B], B)).toEqual([A]);
	});
});

describe('plainExcerpt', () => {
	it('strips markdown and tokens and bounds the length', () => {
		expect(plainExcerpt(`**bold** <@${A}> <!here> \`code\``)).toBe('bold @… @here code');
		expect(plainExcerpt('x'.repeat(200), 10)).toHaveLength(10);
	});
});

describe('messageExcerpt', () => {
	it('reads a message as its text, or a message of files only as its files', () => {
		expect(messageExcerpt({ body: 'Hello **there**', attachmentNames: 'a.png' })).toBe('Hello there');
		expect(messageExcerpt({ body: '', attachmentNames: 'report.pdf' + String.fromCharCode(10) + 'chart.png' })).toBe('📎 report.pdf, chart.png');
		expect(messageExcerpt({ body: '', attachmentNames: null })).toBe('');
		expect(messageExcerpt({ body: '', attachmentNames: 'a'.repeat(50) }, 20)).toHaveLength(20);
	});
});
