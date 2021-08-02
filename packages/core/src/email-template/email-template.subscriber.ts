import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
import { IEmailTemplate } from "@gauzy/contracts";
import { EmailTemplate } from "./email-template.entity";

@EventSubscriber()
export class EmailTemplateSubscriber implements EntitySubscriberInterface<EmailTemplate> {

    /**
    * Indicates that this subscriber only listen to EmailTemplate events.
    */
    listenTo() {
        return EmailTemplate;
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: IEmailTemplate) {
        if (entity.name) {
            entity.title = entity.name.split('/')[0].split('-').join(' ');
        }
    }
}