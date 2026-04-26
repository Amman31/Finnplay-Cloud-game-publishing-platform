
//Checks if an user role is admin
export const isAdminRole = (role: string | undefined): boolean => {
    if (!role) return false;
    return role.toLowerCase() === 'admin';
};

