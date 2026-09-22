import { AgentFormBridgeService } from './agent-form-bridge.service';

/**
 * jsdom-based unit tests for the AgentFormBridgeService DOM bridge.
 *
 * jsdom performs no layout, so `offsetParent` / `offsetWidth` / `offsetHeight`
 * are always 0 — the service's visibility check would treat every element as
 * hidden. The tests stub `offsetHeight` to a non-zero value so elements in
 * the test DOM count as visible.
 */
describe('AgentFormBridgeService', () => {
	let service: AgentFormBridgeService;
	let originalOffsetHeight: PropertyDescriptor | undefined;

	beforeAll(() => {
		originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
		Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
			configurable: true,
			get() {
				return 1;
			}
		});
		// jsdom versions without CSS.escape — minimal fallback for label[for] lookups.
		const cssGlobal: any = (globalThis as any).CSS ?? ((globalThis as any).CSS = {});
		if (typeof cssGlobal.escape !== 'function') {
			cssGlobal.escape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
		}
	});

	afterAll(() => {
		if (originalOffsetHeight) {
			Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
		} else {
			delete (HTMLElement.prototype as any).offsetHeight;
		}
	});

	beforeEach(() => {
		service = new AgentFormBridgeService();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	const renderContactForm = (): void => {
		document.body.innerHTML = `
			<form>
				<h4>Contact Details</h4>
				<label for="full-name">Full Name</label>
				<input id="full-name" type="text" name="fullName" required />
				<label for="email">Email</label>
				<input id="email" type="email" name="email" />
				<label for="notes">Notes</label>
				<textarea id="notes" name="notes"></textarea>
				<button type="submit">Save</button>
			</form>
		`;
	};

	describe('readPage', () => {
		it('should find a simple form with its labeled inputs', () => {
			document.title = 'Contacts – Gauzy';
			renderContactForm();

			const page = service.readPage();

			expect(page.title).toBe('Contacts – Gauzy');
			expect(page.forms).toHaveLength(1);

			const [form] = page.forms;
			expect(form.index).toBe(0);
			expect(form.title).toBe('Contact Details');
			expect(form.submitLabels).toEqual(['Save']);

			const labels = form.fields.map((f) => f.label);
			expect(labels).toEqual(expect.arrayContaining(['Full Name', 'Email', 'Notes']));

			const nameField = form.fields.find((f) => f.label === 'Full Name');
			expect(nameField).toBeDefined();
			expect(nameField!.type).toBe('text');
			expect(nameField!.name).toBe('fullName');
			expect(nameField!.required).toBe(true);

			const notesField = form.fields.find((f) => f.label === 'Notes');
			expect(notesField!.type).toBe('textarea');
			expect(notesField!.required).toBe(false);
		});

		it('should report no forms on an empty page', () => {
			expect(service.readPage().forms).toEqual([]);
		});

		it('should report current field values', () => {
			renderContactForm();
			(document.getElementById('email') as HTMLInputElement).value = 'john@ever.co';

			const [form] = service.readPage().forms;
			expect(form.fields.find((f) => f.label === 'Email')!.value).toBe('john@ever.co');
		});
	});

	describe('fillForm', () => {
		it('should set a text input value and dispatch an input event', async () => {
			renderContactForm();
			const input = document.getElementById('full-name') as HTMLInputElement;
			const capturedEvents: Event[] = [];
			input.addEventListener('input', (event) => capturedEvents.push(event));

			const result = await service.fillForm([{ field: 'Full Name', value: 'Ada Lovelace' }]);

			expect(result.filled).toEqual(['Full Name']);
			expect(result.failed).toEqual([]);
			expect(input.value).toBe('Ada Lovelace');
			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].type).toBe('input');
			expect(capturedEvents[0].bubbles).toBe(true);
		});

		it('should match a field by its name attribute (case-insensitive)', async () => {
			renderContactForm();

			const result = await service.fillForm([{ field: 'fullname', value: 'Grace Hopper' }]);

			expect(result.filled).toEqual(['fullname']);
			expect((document.getElementById('full-name') as HTMLInputElement).value).toBe('Grace Hopper');
		});

		it('should report failed for an unknown field', async () => {
			renderContactForm();

			const result = await service.fillForm([{ field: 'Nonexistent Field', value: 'anything' }]);

			expect(result.filled).toEqual([]);
			expect(result.failed).toHaveLength(1);
			expect(result.failed[0].field).toBe('Nonexistent Field');
			expect(result.failed[0].reason).toContain('No visible field matched');
		});

		it('should mix filled and failed results across instructions', async () => {
			renderContactForm();

			const result = await service.fillForm([
				{ field: 'Email', value: 'ada@ever.co' },
				{ field: 'No Such Field', value: 'x' }
			]);

			expect(result.filled).toEqual(['Email']);
			expect(result.failed).toHaveLength(1);
			expect(result.failed[0].field).toBe('No Such Field');
			expect((document.getElementById('email') as HTMLInputElement).value).toBe('ada@ever.co');
		});
	});

	describe('submitForm', () => {
		it('should report an error when no submit button exists', () => {
			document.body.innerHTML = `
				<form>
					<label for="name">Name</label>
					<input id="name" type="text" name="name" />
				</form>
			`;

			const result = service.submitForm();

			expect(result.success).toBe(false);
			expect(result.error).toBe('No enabled submit button found on the current page.');
			expect(result.buttonLabel).toBeUndefined();
		});

		it('should report an error when the only submit button is disabled', () => {
			document.body.innerHTML = `
				<form>
					<input type="text" name="name" />
					<button type="submit" disabled>Save</button>
				</form>
			`;

			const result = service.submitForm();

			expect(result.success).toBe(false);
			expect(result.error).toBe('No enabled submit button found on the current page.');
		});

		it('should click the enabled submit button and report its label', () => {
			renderContactForm();
			const button = document.querySelector('button[type=submit]') as HTMLButtonElement;
			const click = jest.fn((event: Event) => event.preventDefault());
			button.addEventListener('click', click);

			const result = service.submitForm();

			expect(result.success).toBe(true);
			expect(result.buttonLabel).toBe('Save');
			expect(click).toHaveBeenCalledTimes(1);
		});
	});
});
