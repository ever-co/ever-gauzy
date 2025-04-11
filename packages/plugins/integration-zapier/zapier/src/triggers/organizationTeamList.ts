import { ZObject, Bundle } from 'zapier-platform-core';

interface OrganizationTeam {
    id: string;
    name: string;
    [key: string]: any;
}

const perform = async (z:ZObject, bundle: Bundle) => {
    const organizationId = bundle.inputData.organizationId;

    if (!organizationId) {
        throw new Error('Organization ID is required');
    }

    try {
        const response = await z.request({
            url: `${process.env.API_BASE_URL}/api/organization-team`,
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
        return response.data.items.map((team: OrganizationTeam) => ({
            id: team.id,
            name: team.name
        }));
    } catch (error) {
        z.console.error('Error fetching organization teams:', error);
        throw new Error('Failed to fetch organization teams');
    }
};

export default {
    key: 'organization_team_list',
    noun: 'OrganizationTeam',
    display: {
        label: 'Organization Team List',
        description: 'Gets a list of organization teams.',
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
                helpText: 'Select the organization to get teams for'
            }
        ],
        perform,
        sample: {
            id: '4d0a52f1-4fdd-4a64-9706-51b6182a48cf',
            name: 'Sample Team'
        }
    }
};
