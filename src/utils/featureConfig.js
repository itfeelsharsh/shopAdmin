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
    fromAddress: getEnvVar('EMAIL_FROM') || 'hello@kamikoto.qzz.io',
    supportEmail: getEnvVar('SUPPORT_EMAIL') || 'support@kamikoto.qzz.io',
  },
  notifications: {
    enabled: true
  }
};

export default featureConfig;
