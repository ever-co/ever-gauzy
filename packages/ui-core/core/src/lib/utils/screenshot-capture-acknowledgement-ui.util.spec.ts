import { FormControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { IAgentRestrictionLocation, IScreenshotCaptureAcknowledgement } from '@gauzy/contracts';
import { ScreenshotCaptureAcknowledgementPrompt } from './screenshot-capture-acknowledgement-ui.util';

/**
 * Issue #9872 — the organization settings form asks for the screen capture acknowledgement exactly when the API
 * will require it, and sends it with the save.
 */
describe('ScreenshotCaptureAcknowledgementPrompt', () => {
	const EEA: IAgentRestrictionLocation = { timeZone: 'Europe/Berlin' };
	const ELSEWHERE: IAgentRestrictionLocation = { timeZone: 'America/New_York' };
	const ALL: IScreenshotCaptureAcknowledgement = { lawfulBasis: true, employeeNotice: true, worksCouncil: true };

	function setup(options: {
		stored: boolean;
		location?: IAgentRestrictionLocation | IAgentRestrictionLocation[];
		answer?: IScreenshotCaptureAcknowledgement | null | Error;
	}) {
		const control = new FormControl<boolean>(options.stored);
		let location: IAgentRestrictionLocation | IAgentRestrictionLocation[] = options.location ?? EEA;
		const ask = jest.fn(async () => {
			if (options.answer instanceof Error) throw options.answer;
			return options.answer === undefined ? ALL : options.answer;
		});
		const prompt = new ScreenshotCaptureAcknowledgementPrompt({
			control: () => control,
			persisted: () => ({ allowScreenshotCapture: options.stored }),
			location: () => location,
			ask
		});
		const destroyed = new Subject<void>();
		prompt.bind(takeUntil(destroyed));
		return {
			control,
			prompt,
			ask,
			destroyed,
			moveTo: (next: IAgentRestrictionLocation) => (location = next)
		};
	}

	/** Lets the dialog's promise settle. */
	const settled = () => new Promise((resolve) => setTimeout(resolve));

	it('asks when capture is switched on for an EEA/UK organization, and sends the acknowledgement', async () => {
		const { control, prompt, ask } = setup({ stored: false });

		control.setValue(true);
		await settled();

		expect(ask).toHaveBeenCalledTimes(1);
		expect(control.value).toBe(true);
		expect(prompt.satisfied).toBe(true);
		expect(prompt.payload).toEqual({ screenshotCaptureAcknowledgement: ALL });
	});

	it('switches the toggle back off when the admin cancels', async () => {
		const { control, prompt } = setup({ stored: false, answer: null });

		control.setValue(true);
		await settled();

		expect(control.value).toBe(false);
		expect(prompt.payload).toEqual({});
	});

	it('treats an incomplete answer, or a failure to ask, as a cancel', async () => {
		const partial = setup({ stored: false, answer: { ...ALL, worksCouncil: false } });
		partial.control.setValue(true);
		await settled();
		expect(partial.control.value).toBe(false);

		const failed = setup({ stored: false, answer: new Error('dialog failed') });
		failed.control.setValue(true);
		await settled();
		expect(failed.control.value).toBe(false);
	});

	it('never asks outside the EEA and the UK', async () => {
		const { control, prompt, ask } = setup({ stored: false, location: ELSEWHERE });

		control.setValue(true);
		await settled();

		expect(ask).not.toHaveBeenCalled();
		expect(await prompt.confirm()).toBe(true);
		expect(prompt.payload).toEqual({});
	});

	it('asks when the stored location is in the EEA/UK even if the pending one is not, as the API does', async () => {
		// The settings page passes [stored, pending]: moving out of the EEA/UK in the same save still asks.
		const { control, prompt, ask } = setup({ stored: false, location: [EEA, ELSEWHERE] });

		control.setValue(true);
		await settled();

		expect(ask).toHaveBeenCalledTimes(1);
		expect(prompt.payload).toEqual({ screenshotCaptureAcknowledgement: ALL });
	});

	it('never asks for an organization that already captures, nor to turn capture off', async () => {
		const { control, prompt, ask } = setup({ stored: true });

		control.setValue(false);
		control.setValue(true);
		await settled();

		expect(ask).not.toHaveBeenCalled();
		expect(prompt.payload).toEqual({});
	});

	it('asks again at save when the organization moved into the EEA/UK after the toggle', async () => {
		const { control, prompt, ask, moveTo } = setup({ stored: false, location: ELSEWHERE });
		control.setValue(true);
		await settled();
		expect(ask).not.toHaveBeenCalled();

		moveTo(EEA);

		expect(prompt.satisfied).toBe(false);
		expect(await prompt.confirm()).toBe(true);
		expect(ask).toHaveBeenCalledTimes(1);
		expect(prompt.payload).toEqual({ screenshotCaptureAcknowledgement: ALL });
	});

	it('forgets the acknowledgement when capture is switched off, so switching it on asks again', async () => {
		const { control, ask } = setup({ stored: false });

		control.setValue(true);
		await settled();
		control.setValue(false);
		control.setValue(true);
		await settled();

		expect(ask).toHaveBeenCalledTimes(2);
	});

	it('asks once when the toggle and the save ask together', async () => {
		const { control, prompt, ask } = setup({ stored: false });

		control.setValue(true);
		const saving = prompt.confirm();
		await settled();

		expect(await saving).toBe(true);
		expect(ask).toHaveBeenCalledTimes(1);
	});

	it('forgets the acknowledgement on reset', async () => {
		const { control, prompt } = setup({ stored: false });
		control.setValue(true);
		await settled();

		prompt.reset();

		expect(prompt.satisfied).toBe(false);
		expect(prompt.payload).toEqual({});
	});

	it('stops listening with the component', async () => {
		const { control, ask, destroyed } = setup({ stored: false });

		destroyed.next();
		control.setValue(true);
		await settled();

		expect(ask).not.toHaveBeenCalled();
	});
});
