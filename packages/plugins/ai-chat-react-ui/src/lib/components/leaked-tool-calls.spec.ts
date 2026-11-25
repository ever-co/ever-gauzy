import { stripLeakedToolCalls } from './leaked-tool-calls';

describe('stripLeakedToolCalls', () => {
	it('leaves ordinary prose alone', () => {
		const text = 'You have **19 projects**.\n\n- Alpha\n- Beta';
		expect(stripLeakedToolCalls(text)).toBe(text);
	});

	it('removes a bare JSON object written on its own line', () => {
		const text = 'Let me open it in the canvas.\n\n{"path": "/pages/organization/projects"}';
		expect(stripLeakedToolCalls(text)).toBe('Let me open it in the canvas.');
	});

	it('removes the JSON and the empty table it was wrapped in', () => {
		const text = 'Let me open it.\n\n|\n|-|\n| {"path": "/pages/organization/projects"} |';
		expect(stripLeakedToolCalls(text)).toBe('Let me open it.');
	});

	it('removes a multi-line JSON object', () => {
		const text = 'Opening it now.\n{\n  "path": "/pages/tasks"\n}\nDone.';
		expect(stripLeakedToolCalls(text)).toBe('Opening it now.\nDone.');
	});

	it('removes tool-call wrapper blocks and snake_case tool tags', () => {
		expect(stripLeakedToolCalls('Sure.\n<tool_call>{"name":"open_page","arguments":{}}</tool_call>')).toBe('Sure.');
		expect(stripLeakedToolCalls('Sure.\n<open_page>{"path":"/pages/tasks"}</open_page>\nThere.')).toBe(
			'Sure.\n\nThere.'
		);
		expect(
			stripLeakedToolCalls('Sure.\n<invoke name="open_page">\n<parameter name="path">/x</parameter>\n</invoke>')
		).toBe('Sure.');
	});

	it('removes an <input> tag with its arguments, and the table cell around it', () => {
		const text = 'Let me open it.\n\n|\n|-|\n| <input>{"path": "/pages/organization/projects"}</input> |';
		expect(stripLeakedToolCalls(text)).toBe('Let me open it.');
		expect(stripLeakedToolCalls('Opening it.\n<input>\n{"path": "/pages/tasks"}\nDone.')).toBe(
			'Opening it.\n\nDone.'
		);
	});

	it('keeps the text after an unclosed tag once the reply is finished', () => {
		expect(stripLeakedToolCalls('Opening it.\n<tool>\nHere is what I found.')).toBe(
			'Opening it.\n\nHere is what I found.'
		);
	});

	it('leaves tags written inside inline code alone', () => {
		const text = 'Use an `<input>` element, or `<tool_call>` in the prompt.';
		expect(stripLeakedToolCalls(text)).toBe(text);
	});

	it('hides a call that is still being written while streaming', () => {
		expect(stripLeakedToolCalls('Opening it.\n<open_page>{"pa', true)).toBe('Opening it.');
		expect(stripLeakedToolCalls('Opening it.\n{"path": "/pages/ta', true)).toBe('Opening it.');
	});

	it('keeps real tables, including their separator row', () => {
		const text = '| Name | Hours |\n|---|---|\n| Alpha | 3 |';
		expect(stripLeakedToolCalls(text)).toBe(text);
	});

	it('never touches fenced code blocks', () => {
		const text = 'Here is the payload:\n\n```json\n{"path": "/pages/tasks"}\n```';
		expect(stripLeakedToolCalls(text)).toBe(text);
	});

	it('keeps JSON-looking text that is not a JSON object', () => {
		const text = 'Use {curly braces} for placeholders.';
		expect(stripLeakedToolCalls(text)).toBe(text);
	});
});
