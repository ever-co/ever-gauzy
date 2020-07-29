import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactSelectorComponent } from './contact-selector.component';

describe('ContactSelectorComponent', () => {
	let component: ContactSelectorComponent;
	let fixture: ComponentFixture<ContactSelectorComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ContactSelectorComponent]
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
