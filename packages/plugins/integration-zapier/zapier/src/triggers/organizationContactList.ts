import { ZObject, Bundle } from 'zapier-platform-core';

interface Contact {
    id: string;
    name: string;
    [key: string]: any;
}

const perform = async (z: ZObject, bundle: Bundle) => {
    const organizationId = bundle.inputData.organizationId;

    if (!organizationId) {
        throw new Error('Organization ID is required');
    }

    try {
        const response = await z.request({
            url: `${process.env.API_BASE_URL}/api/organization-contact`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${bundle.authData['access_token']}`,
            },
            params: {
                organizationId: organizationId
            }
        });
        if (!response.data || !Array.isArray(response.data.items)) {
            throw new Error('Unexpected API response format');
        }

        return response.data.items.map((contact: Contact) => ({
            id: contact.id,
            name: contact.name
        }));
    } catch (error) {
        z.console.error('Error fetching organization contacts:', error);
        throw new Error('Failed to fetch organization contacts');
    }
};

export default {
    key: 'organization_contact_list',
    noun: 'OrganizationContact',
    display: {
        label: 'Organization Contact List',
        description: 'Gets a list of organization contacts.',
        hidden: true, // Hidden from the UI as it's just for dynamic dropdowns
    },
    operation: {
        inputFields: [
            {
                key: 'organizationId',
                type: 'string',
                label: 'Organization',
                required: true,
                dynamic: 'organization_list.id.name',
                helpText: 'Select the organization to get contacts for'
            }
        ],
        perform,
        sample: {
            id: '2db881af-ecf8-4a8a-93a7-9655a3e6da7b',
            name: 'Sample Contact'
        }
    }
};
