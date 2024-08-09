import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { RepositorySelectorComponent } from './repository-selector.component';

describe('RepositorySelectorComponent', () => {
	let component: RepositorySelectorComponent;
	let fixture: ComponentFixture<RepositorySelectorComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [RepositorySelectorComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(RepositorySelectorComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
