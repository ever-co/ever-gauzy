export * from './action-confirmation/action-confirmation.component';
export * from './archive-confirmation/archive-confirmation.component';
export * from './basic-info/basic-info-form.component';
export * from './candidate-action-confirmation/candidate-action-confirmation.component';
export * from './delete-confirmation/delete-confirmation.component';
export * from './countdown-confirmation/countdown-confirmation.component';

import { ActionConfirmationComponent } from './action-confirmation/action-confirmation.component';
import { ArchiveConfirmationComponent } from './archive-confirmation/archive-confirmation.component';
import { BasicInfoFormComponent } from './basic-info/basic-info-form.component';
import { CandidateActionConfirmationComponent } from './candidate-action-confirmation/candidate-action-confirmation.component';
import { CountdownConfirmationComponent } from './countdown-confirmation/countdown-confirmation.component';
import { DeleteConfirmationComponent } from './delete-confirmation/delete-confirmation.component'

export const COMPONENTS = [
    BasicInfoFormComponent,
    DeleteConfirmationComponent,
    ActionConfirmationComponent,
    ArchiveConfirmationComponent,
    CandidateActionConfirmationComponent,
    CountdownConfirmationComponent
];