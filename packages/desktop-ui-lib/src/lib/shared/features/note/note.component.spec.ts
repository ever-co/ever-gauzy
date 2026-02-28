import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoteComponent } from './note.component';
describe('NoteComponent', () => {
	let component: NoteComponent;
	let fixture: ComponentFixture<NoteComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [NoteComponent]
		}).compileComponents();
		fixture = TestBed.createComponent(NoteComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
