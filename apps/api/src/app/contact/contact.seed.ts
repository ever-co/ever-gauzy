import { Connection } from 'typeorm';
import { Contact } from './contact.entity';
import * as faker from'faker';

export const createRandomContacts = async (
  connection: Connection,
  noOfRandomContacts:number
):Promise<Contact[]>=>{

  const contacts:Contact[]=[];
  for(let i=0;i<noOfRandomContacts;i++){
    let contact = new Contact();
    contact.firstName = faker.name.firstName();
    contact.lastName = faker.name.lastName();
    contact.address = faker.address.streetAddress();
    contact.address2 = faker.address.secondaryAddress();
    contact.city = faker.address.city();
    contact.country = faker.address.country();
    contact.name = contact.firstName + " " + contact.lastName;
    contacts.push(contact);
  }
  return await connection.manager.save(contacts);
};
