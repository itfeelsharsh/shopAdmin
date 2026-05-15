/**
 * Feature Configuration for Shop Admin
 */
const getEnvVar = (name) => {
  const reactValue = process.env[`REACT_APP_${name}`];
  if (reactValue !== undefined) return reactValue;
  return process.env[name];
};

const featureConfig = {
  email: {
    enabled: getEnvVar('EMAIL_ENABLED') === 'true' || true, // Default to true for admin
    useEmailServer: false,
    fromAddress: getEnvVar('EMAIL_FROM') || 'noreply@kamikoto.nsl',
    supportEmail: getEnvVar('SUPPORT_EMAIL') || 'support@kamikoto.nsl',
  },
  notifications: {
    enabled: true
  }
};

export default featureConfig;
