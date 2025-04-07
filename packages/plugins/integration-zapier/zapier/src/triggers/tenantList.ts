import { ZObject, Bundle } from 'zapier-platform-core';

const perform = async (z: ZObject, bundle: Bundle) => {
    try {
        const response = await z.request({
            url: `${process.env.API_BASE_URL}/api/tenant`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${bundle.authData['access_token']}`,
            },
        });

        return response.data.items.map((tenant: any) => ({
            id: tenant.id,
            name: tenant.name
        }));
    } catch (error) {
        z.console.error('Error fetching tenants:', error);
        throw new Error('Failed to fetch tenants');
    }
};

export default {
    key: 'tenant_list',
    noun: 'Tenant',
    display: {
      label: 'Tenant List',
      description: 'Gets a list of tenants.',
      hidden: true, // Hidden from the UI as it's just for dynamic dropdowns
    },
    operation: {
      perform,
      sample: {
        id: '88507509-f7cb-44f4-ae60-894f950477a9',
        name: 'Default Tenant'
      }
    }
  };

