import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxMagicSignInWorkspaceComponent } from './magic-login-workspace.component';

describe('NgxMagicSignInWorkspaceComponent', () => {
	let component: NgxMagicSignInWorkspaceComponent;
	let fixture: ComponentFixture<NgxMagicSignInWorkspaceComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [NgxMagicSignInWorkspaceComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(NgxMagicSignInWorkspaceComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
