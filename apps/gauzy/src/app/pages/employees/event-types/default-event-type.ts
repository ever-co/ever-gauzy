import { IEventTypeViewModel } from "@gauzy/contracts";

export const DEFAULT_EVENT_TYPE: IEventTypeViewModel[] = [
    {
        id: null,
        title: '15 Minutes Event',
        description: 'This is a default event type.',
        duration: 15,
        durationUnit: 'Minute(s)',
        isActive: false,
        active: 'No',
        durationFormat: '15 Minute(s)',
        tags: [],
        isDefault: true
    },
    {
        id: null,
        title: '30 Minutes Event',
        description: 'This is a default event type.',
        duration: 30,
        durationUnit: 'Minute(s)',
        isActive: false,
        active: 'No',
        durationFormat: '30 Minute(s)',
        tags: [],
        isDefault: true
    },
    {
        id: null,
        title: '60 Minutes Event',
        description: 'This is a default event type.',
        duration: 60,
        durationUnit: 'Minute(s)',
        isActive: false,
        active: 'No',
        durationFormat: '60 Minute(s)',
        tags: [],
        isDefault: true
    }
];