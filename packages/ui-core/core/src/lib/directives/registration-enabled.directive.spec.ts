import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { RegistrationConfigService } from '../services/auth/registration-config.service';
import { RegistrationEnabledDirective } from './registration-enabled.directive';

/** A sign-in page in miniature: OnPush, with a Register link behind the directive. */
@Component({
	selector: 'ga-registration-enabled-host',
	standalone: true,
	imports: [RegistrationEnabledDirective],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<a class="login" href="/auth/login">Login</a>
		<p *gaRegistrationEnabled class="register"><a href="/auth/register">Register</a></p>
	`
})
class HostComponent {}

describe('RegistrationEnabledDirective', () => {
	let answer: Subject<boolean>;

	function render() {
		answer = new Subject<boolean>();
		TestBed.configureTestingModule({
			imports: [HostComponent],
			providers: [{ provide: RegistrationConfigService, useValue: { registrationEnabled$: answer } }]
		});
		const fixture = TestBed.createComponent(HostComponent);
		fixture.detectChanges();
		return fixture;
	}

	const register = (fixture: ReturnType<typeof render>) =>
		(fixture.nativeElement as HTMLElement).querySelector('.register');

	it('shows nothing before the server answered, so a closed server never flashes the link', () => {
		const fixture = render();

		expect(register(fixture)).toBeNull();
		expect((fixture.nativeElement as HTMLElement).querySelector('.login')).not.toBeNull();
	});

	it('shows the Register link while sign-ups are open', () => {
		const fixture = render();

		answer.next(true);
		fixture.detectChanges();

		expect(register(fixture)?.textContent).toContain('Register');
	});

	it('hides the Register link while sign-ups are closed', () => {
		const fixture = render();

		answer.next(false);
		fixture.detectChanges();

		expect(register(fixture)).toBeNull();
	});
});
