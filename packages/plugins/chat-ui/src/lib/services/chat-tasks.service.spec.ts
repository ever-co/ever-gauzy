// The ui-core barrel boots half the app (and needs packages this spec does not): what the availability names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChatTaskStatusChoice } from '../chat-tasks';
import { ChatAvailabilityService } from './chat-availability.service';
import { ChatTasksService } from './chat-tasks.service';

describe('ChatTasksService', () => {
	let tasks: ChatTasksService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: ChatAvailabilityService, useValue: { scope$: of({ organizationId: 'o1', tenantId: 't1' }) } }
			]
		});
		tasks = TestBed.inject(ChatTasksService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	const taskReads = (): TestRequest[] => http.match((request) => request.method === 'GET' && /\/tasks$/.test(request.url));
	const page = (title: string, members: Array<{ id: string }> = []) => ({ items: [{ id: 't1', title, members }], total: 1 });
	const summary = () => tasks.summaries().get('t1');

	it('keeps the answer of the latest read, even when an older read answers last', () => {
		tasks.ensure(['t1']);
		tasks.refresh(['t1']);
		const [older, newer] = taskReads();
		newer.flush(page('Newer', [{ id: 'e1' }, { id: 'e2' }]));
		older.flush(page('Older', [{ id: 'e1' }]));
		expect(summary()?.title).toBe('Newer');
		expect(summary()?.assigneeIds).toEqual(['e1', 'e2']);
	});

	it('reads a task again now for a card, and lets a later message ask again after a passing failure', () => {
		tasks.ensure(['t1']);
		taskReads()[0].flush(page('First'));
		let answered: unknown = 'nothing';
		tasks.reload('t1').subscribe((value) => (answered = value));
		taskReads()[0].flush({ message: 'Bad gateway' }, { status: 502, statusText: 'Bad Gateway' });
		expect(answered).toBeUndefined();
		// The summary shown is kept, and the task is no longer counted as read.
		expect(summary()?.title).toBe('First');
		tasks.ensure(['t1']);
		taskReads()[0].flush(page('Second'));
		expect(summary()?.title).toBe('Second');
	});

	it("keeps a card's read when a later read is still under way, and the later one's answer after it", () => {
		tasks.ensure(['t1']);
		taskReads()[0].flush(page('First', [{ id: 'e1' }]));
		// A card changed the task and reads it again; a hint starts another read meanwhile.
		let answered: unknown = 'nothing';
		tasks.reload('t1').subscribe((value) => (answered = value));
		tasks.refresh(['t1']);
		const [cardRead, hintRead] = taskReads();
		cardRead.flush(page('After the change', [{ id: 'e1' }, { id: 'e2' }]));
		// The card's read is in place at once: the card may take a change again with the stored list.
		expect(answered).toEqual(expect.objectContaining({ assigneeIds: ['e1', 'e2'] }));
		expect(summary()?.assigneeIds).toEqual(['e1', 'e2']);
		hintRead.flush(page('Later still', [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]));
		expect(summary()?.assigneeIds).toEqual(['e1', 'e2', 'e3']);
	});

	it('drops a read still under way when a newer summary was put in place', () => {
		tasks.ensure(['t1']);
		tasks.remember({ id: 't1', title: 'Created here' } as never);
		taskReads()[0].flush(page('Read before'));
		expect(summary()?.title).toBe('Created here');
	});

	it('reads the statuses of a project once, and again after a failure', () => {
		const task = { id: 't1', key: null, title: 'x', status: 'Open', organizationId: 'o1', projectId: 'p1' };
		const statusReads = () => http.match((request) => request.method === 'GET' && /\/task-statuses$/.test(request.url));
		let first: ChatTaskStatusChoice[] = [];
		tasks.statusChoices(task).subscribe((choices) => (first = choices));
		statusReads()[0].flush({ message: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' });
		// The card offers the task's own status meanwhile.
		expect(first).toEqual([{ name: 'Open', id: null }]);
		let second: ChatTaskStatusChoice[] = [];
		tasks.statusChoices(task).subscribe((choices) => (second = choices));
		statusReads()[0].flush({ items: [{ id: 's1', name: 'Open', order: 1 }, { id: 's2', name: 'Done', order: 2 }], total: 2 });
		expect(second.map((choice) => choice.name)).toEqual(['Open', 'Done']);
		// Kept for the next card of the project.
		tasks.statusChoices(task).subscribe();
		expect(statusReads()).toHaveLength(0);
	});
});
