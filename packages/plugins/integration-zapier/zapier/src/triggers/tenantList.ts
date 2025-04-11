import { ZObject, Bundle } from 'zapier-platform-core';

interface Tenant {
    id: string;
    name: string;
    [key: string]: any;
}

const perform = async (z: ZObject, bundle: Bundle) => {
    try {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const response = await z.request({
            url: `${baseUrl}/api/tenant`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${bundle.authData.access_token}`,
            },
        });

        if (!response.data || !Array.isArray(response.data.items)) {
            throw new Error('Unexpected API response format');
        }

        return response.data.items.map((tenant: Tenant) => ({
            id: tenant.id,
            name: tenant.name,
        }));
    } catch (error: any) {
        z.console.error('Error fetching tenants:', error);
        throw new Error(`Failed to fetch tenants: ${error.message || 'Unknown error'}`);
    }
};

export default {
    key: 'tenant_list',
    noun: 'Tenant',
    display: {
        label: 'Tenant List',
        description: 'Gets a list of tenants for dynamic dropdown selection.',
        hidden: true, // Hidden from the UI as it's just for dynamic dropdowns
    },
    operation: {
        perform,
        sample: {
            id: '88507509-f7cb-44f4-ae60-894f950477a9',
            name: 'Default Tenant',
        },
    },
};
