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
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const response = await z.request({
            url: `${baseUrl}/api/organization-contact`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${bundle.authData.access_token}`,
            },
            params: { organizationId }
        });
        if (!response.data || !Array.isArray(response.data.items)) {
            throw new Error('Unexpected API response format');
        }

        return response.data.items.map((contact: Contact) => ({
            id: contact.id,
            name: contact.name
        }));
    } catch (error: any) {
        z.console.error('Error fetching organization contacts:', error);
        throw new Error(`Failed to fetch organization contacts: ${error.message || 'Unknown error'}`);
    }
};

export default {
    key: 'organization_contact_list',
    noun: 'OrganizationContact',
    display: {
        label: 'Organization Contact List',
        description: 'Gets a list of organization contacts for dynamic dropdown selection.',
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
