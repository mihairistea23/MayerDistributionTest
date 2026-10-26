// Browser Firebase configuration for Mayer Distribution.
// The Firebase web API key is a client identifier, not a password.
// Existing browser-saved configuration (md_firebase_web_config) takes precedence.
export function firebaseConfig(legacyConfig = null) {
  return {
    apiKey: legacyConfig?.apiKey || "AIzaSyCmLpq1RTxUTkR1GI3L6Pq_CXlNvFeGcPg",
    authDomain: legacyConfig?.authDomain || "mayerdistributiontest.firebaseapp.com",
    projectId: legacyConfig?.projectId || "mayerdistributiontest",
    appId: legacyConfig?.appId || "1:750431683253:web:94b358203a8b4a7a79f4fc"
  };
}
