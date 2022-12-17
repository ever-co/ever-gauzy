import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
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
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: EmailTemplate, event?: LoadEvent<EmailTemplate>): void | Promise<any> {
        try {
            if (entity.name) {
                entity.title = entity.name.split('/')[0].split('-').join(' ');
            }
        } catch (error) {
            console.log(error);
        }
    }
}