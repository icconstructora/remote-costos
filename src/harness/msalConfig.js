// Misma configuración que usa el shell (frontend/src/authConfig.js).
// CLIENT_ID y TENANT_ID son identificadores públicos de la app registration
// "lm-vic-auth" — no son secretos.
export const msalConfig = {
  auth: {
    clientId: "1da0f9dd-cc35-489c-937b-c66387864730",
    authority: "https://login.microsoftonline.com/129cb8aa-2444-49b4-acc9-3f6a696f1ff0",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email", "User.Read"],
};

// Token para llamar al backend único (api.icconstructora.co)
export const apiRequest = {
  scopes: ["api://1da0f9dd-cc35-489c-937b-c66387864730/access_as_user"],
};
