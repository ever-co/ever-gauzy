import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertComponent } from './alert.component';
describe('AlertComponent', () => {
	let component: AlertComponent;
	let fixture: ComponentFixture<AlertComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AlertComponent]
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(AlertComponent);
		component = fixture.componentInstance;
		// Opened by NbDialogService with a `data` context; the template reads it unguarded.
		component.data = { title: 'Title', message: 'Message', status: 'info' };
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
