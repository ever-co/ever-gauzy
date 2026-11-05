import { SelectorService } from '../shared/+state/selector.service';
import { SelectorValidator } from '../shared/utils/validation/selector.validator';
import { ITimerRequirements, isTeamRequired, timerRequiredFields } from './timer-required-fields';

/** A selector holding a value or not, which records the error the validation sets on it. */
class SelectorStandIn extends SelectorService<{ id: string }> {
	public readonly errors: unknown[];

	constructor(selected: { id: string } | null) {
		const errors: unknown[] = [];
		const store = { setError: (error: unknown) => errors.push(error), updateSelected: () => undefined };
		super(store as never, { selected } as never);
		this.errors = errors;
	}

	public async load(): Promise<void> {
		return undefined;
	}

	/** The error the last validation left on the selector. */
	public get lastError(): unknown {
		return this.errors.at(-1);
	}
}

/**
 * The desktop timer checks the organization's switches before it starts, and keeps the timer stopped with the
 * missing selector marked when one is not met. It checked the project, the task, the client and the description; it
 * now checks the team the same way. An API without `requireTeam` (before the server enforces it) means no team is
 * required.
 */
describe('timerRequiredFields', () => {
	const filled = () => ({
		project: new SelectorStandIn({ id: 'project-1' }),
		task: new SelectorStandIn({ id: 'task-1' }),
		client: new SelectorStandIn({ id: 'client-1' }),
		note: new SelectorStandIn({ id: 'note' }),
		team: new SelectorStandIn({ id: 'team-1' })
	});

	const validates = (organization: ITimerRequirements, sources: ReturnType<typeof filled>) => {
		const validator = new SelectorValidator(timerRequiredFields(organization, sources));
		return validator.validateAll();
	};

	it('keeps the timer stopped and marks the team when the organization requires one and none is picked', () => {
		const sources = { ...filled(), team: new SelectorStandIn(null) };

		expect(validates({ requireTeam: true }, sources)).toBe(false);
		expect(sources.team.lastError).toEqual({ required: true });
		expect(sources.project.lastError).toBeNull();
	});

	it('starts when the organization requires a team and one is picked', () => {
		const sources = filled();

		expect(validates({ requireTeam: true }, sources)).toBe(true);
		expect(sources.team.lastError).toBeNull();
	});

	it.each([{}, { requireTeam: false }, { requireTeam: undefined }])(
		'starts without a team when the organization does not require one (%p)',
		(organization) => {
			const sources = { ...filled(), team: new SelectorStandIn(null) };

			expect(validates(organization, sources)).toBe(true);
			expect(sources.team.lastError).toBeNull();
		}
	);

	it('still checks the project the way it did', () => {
		const sources = { ...filled(), project: new SelectorStandIn(null), team: new SelectorStandIn(null) };

		expect(validates({ requireProject: true }, sources)).toBe(false);
		expect(sources.project.lastError).toEqual({ required: true });
		expect(sources.team.lastError).toBeNull();
	});

	it('lists the switches in the order the timer checked them, the team last', () => {
		const sources = filled();
		const organization = {
			requireProject: true,
			requireTask: false,
			requireClient: true,
			requireDescription: false,
			requireTeam: true
		};

		expect(timerRequiredFields(organization, sources)).toEqual([
			{ service: sources.project, requireField: true },
			{ service: sources.task, requireField: false },
			{ service: sources.client, requireField: true },
			{ service: sources.note, requireField: false },
			{ service: sources.team, requireField: true }
		]);
	});
});

describe('isTeamRequired', () => {
	it.each([
		[undefined, false],
		[null, false],
		[{}, false],
		[{ requireTeam: false }, false],
		[{ requireTeam: true }, true]
	])('reads %p as %p', (organization, required) => {
		expect(isTeamRequired(organization as ITimerRequirements | null | undefined)).toBe(required);
	});
});
