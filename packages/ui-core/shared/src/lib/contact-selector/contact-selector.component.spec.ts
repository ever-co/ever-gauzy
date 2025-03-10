import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ContactSelectorComponent } from './contact-selector.component';

describe('ContactSelectorComponent', () => {
	let component: ContactSelectorComponent;
	let fixture: ComponentFixture<ContactSelectorComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ContactSelectorComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ContactSelectorComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
