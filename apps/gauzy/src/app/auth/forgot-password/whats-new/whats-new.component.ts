import { Component } from "@angular/core";
import { UntilDestroy } from "@ngneat/until-destroy";

const faqData = [
	{
		title: "Reset password",
		icon: "unlock-outline",
		content: 'Open your Account. You might need to sign in. Under "Security", select Signing in. Choose Password. You might need to sign in again. Enter your new password, then select Change Password.'
	},
	{
		title: "Secure password",
		icon: "umbrella-outline",
		content: 'For example, Use a password that has at least 8-16 characters, use at least one number, one uppercase letter one lowercase letter and one special symbol.'
	},
]

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-forgot-password-whats-new',
	templateUrl: './whats-new.component.html',
	styleUrls: ['./whats-new.component.scss'],
})
export class NgxForgotPasswordWhatsNewComponent {
	items = faqData;
}
