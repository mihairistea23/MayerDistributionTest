// Browser Firebase configuration for Mayer Distribution.
// The API key is intentionally reused from the legacy setup on browsers that already
// configured the test build. Firebase web API keys are client identifiers, not passwords.
// Replace the fallback only with the Web API key shown in Firebase Console if setting up a new device.
export function firebaseConfig(legacyConfig = null) {
  return {
    apiKey: legacyConfig?.apiKey || "REPLACE_WITH_MAYERDISTRIBUTION2026_WEB_API_KEY",
    authDomain: legacyConfig?.authDomain || "mayerdistribution2026.firebaseapp.com",
    projectId: legacyConfig?.projectId || "mayerdistribution2026",
    appId: legacyConfig?.appId || "1:894985579760:web:01d7707cca1c3f6a3ca635"
  };
}
