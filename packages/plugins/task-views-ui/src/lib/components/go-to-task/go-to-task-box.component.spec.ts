// The ui-core barrel boots half the app (and needs packages this spec does not have): what the services name from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {}
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TaskReferenceNavigatorService } from '../../services/task-reference-navigator.service';
import { TaskViewsAvailabilityService } from '../../services/task-views-availability.service';
import { GoToTaskBoxComponent } from './go-to-task-box.component';

describe('GoToTaskBoxComponent', () => {
	let fixture: ComponentFixture<GoToTaskBoxComponent>;
	let goTo: jest.Mock;
	const host = () => fixture.nativeElement as HTMLElement;
	const scope = { userId: 'u1', organizationId: 'org' };

	beforeEach(async () => {
		goTo = jest.fn();
		await TestBed.configureTestingModule({
			imports: [GoToTaskBoxComponent],
			providers: [
				{ provide: TaskReferenceNavigatorService, useValue: { goTo } },
				{ provide: TaskViewsAvailabilityService, useValue: { scope$: of(scope) } }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(GoToTaskBoxComponent);
	});

	async function submit(text: string) {
		// A field of a form joins it a tick after the first render.
		await new Promise((resolve) => setTimeout(resolve, 0));
		const field = host().querySelector('input') as HTMLInputElement;
		field.value = text;
		field.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		await fixture.componentInstance.submit();
		fixture.detectChanges();
	}

	it('draws the field and its button at the size asked for', () => {
		fixture.componentRef.setInput('size', 'medium');
		fixture.detectChanges();
		expect(host().querySelector('input')?.classList).toContain('size-medium');
		expect(host().querySelector('button')?.classList).toContain('size-medium');
	});

	it('looks the text up with its own abort signal, and says it opened', async () => {
		goTo.mockResolvedValue({ opened: true });
		const opened = jest.fn();
		fixture.componentInstance.opened.subscribe(opened);
		fixture.detectChanges();
		await submit(' API-42 ');
		expect(goTo).toHaveBeenCalledWith('API-42', scope, expect.any(AbortSignal));
		expect(opened).toHaveBeenCalledTimes(1);
		expect((host().querySelector('input') as HTMLInputElement).value).toBe('');
	});

	it('shows why nothing opened, and aborts its signal when it goes away', async () => {
		goTo.mockResolvedValue({
			opened: false,
			messageKey: 'TASK_VIEWS.GOTO.NOT_FOUND',
			params: { reference: 'API-9' }
		});
		fixture.detectChanges();
		await submit('API-9');
		expect(host().querySelector('[data-test="go-to-message"]')?.textContent).toContain('TASK_VIEWS.GOTO.NOT_FOUND');
		const signal = goTo.mock.calls[0][2] as AbortSignal;
		expect(signal.aborted).toBe(false);
		fixture.destroy();
		expect(signal.aborted).toBe(true);
	});
});
