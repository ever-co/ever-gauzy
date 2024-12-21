import { Component } from '@angular/core';
import { InvitationTypeEnum } from '@gauzy/contracts';

@Component({
    selector: 'ga-manage-candidate-invite',
    templateUrl: './manage-candidate-invite.component.html',
    standalone: false
})
export class ManageCandidateInviteComponent {

	invitationTypeEnum = InvitationTypeEnum;

	constructor() {}
}
