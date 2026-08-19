export const resolveKieCallbackUrl = () => {
  const envCallbackUrl = process.env.KIE_CALLBACK_URL;
  return envCallbackUrl || undefined;
};
