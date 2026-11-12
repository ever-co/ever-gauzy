import { formatBinding } from './shortcut-registry';
import { RecorderStep, ShortcutRecorder } from './shortcut-recorder';

const press = (code: string, key: string, extra: Partial<KeyboardEvent> = {}) =>
	({ code, key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra }) as KeyboardEvent;

/** The binding a step recorded (a spec fails on a step that has none). */
const bindingOf = (step: RecorderStep) => {
	if (!('binding' in step)) throw new Error(`No binding in a step ${step.state}`);
	return step.binding;
};

describe('ShortcutRecorder', () => {
	let now = 0;
	const recorder = () => new ShortcutRecorder(2, 1_000, () => now);

	beforeEach(() => (now = 0));

	it('records two keys in a row as a sequence', () => {
		const rec = recorder();
		expect(rec.press(press('KeyG', 'g')).state).toBe('recording');
		now = 400;
		const step = rec.press(press('KeyT', 't'));
		expect(step.state).toBe('done');
		expect(formatBinding(bindingOf(step))).toBe('g t');
	});

	it('takes one key as the binding when the wait runs out', () => {
		const rec = recorder();
		rec.press(press('KeyJ', 'j'));
		const step = rec.timeout();
		expect(step.state).toBe('done');
		expect(formatBinding(bindingOf(step))).toBe('j');
		expect(rec.timeout().state).toBe('cancelled');
	});

	it('starts over when the second key comes after the wait', () => {
		const rec = recorder();
		rec.press(press('KeyG', 'g'));
		now = 5_000;
		const step = rec.press(press('KeyT', 't'));
		expect(step.state).toBe('recording');
		expect(formatBinding(bindingOf(step))).toBe('t');
	});

	it('ends at once on a chord with Ctrl/⌘ or Alt', () => {
		const step = recorder().press(press('KeyS', 's', { metaKey: true }));
		expect(step.state).toBe('done');
		expect(formatBinding(bindingOf(step))).toBe('mod+s');
	});

	it('cancels on Esc and ignores a modifier alone', () => {
		const rec = recorder();
		expect(rec.press(press('ShiftLeft', 'Shift', { shiftKey: true })).state).toBe('ignored');
		rec.press(press('KeyG', 'g'));
		expect(rec.press(press('Escape', 'Escape')).state).toBe('cancelled');
		expect(rec.binding).toEqual([]);
	});
});
