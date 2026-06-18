import { useState } from "react";
import { MsalProvider, useMsal, useIsAuthenticated } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "./msalConfig";
import TuComponente from "../TuComponente";

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || "real";

const frameStyle = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
};

const headerStyle = {
  background: "var(--color-brand)",
  color: "#fff",
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 600,
  flexShrink: 0,
};

const contentStyle = {
  flex: 1,
  overflow: "auto",
};

function MockHarness() {
  return (
    <div style={frameStyle}>
      <div style={headerStyle}>Harness — Modo rápido (datos de ejemplo, sin login)</div>
      <div style={contentStyle}>
        <TuComponente />
      </div>
    </div>
  );
}

function RealHarnessInner() {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return (
      <div style={{ ...frameStyle, alignItems: "center", justifyContent: "center" }}>
        <button
          onClick={() => instance.loginPopup(loginRequest)}
          style={{
            background: "var(--color-brand)",
            color: "#fff",
            border: "none",
            padding: "10px 24px",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
          }}
        >
          Iniciar sesión con Microsoft
        </button>
      </div>
    );
  }

  return (
    <div style={frameStyle}>
      <div style={headerStyle}>Harness — Modo real (tu sesión Microsoft)</div>
      <div style={contentStyle}>
        <TuComponente />
      </div>
    </div>
  );
}

function RealHarness() {
  const [msalInstance] = useState(() => new PublicClientApplication(msalConfig));
  return (
    <MsalProvider instance={msalInstance}>
      <RealHarnessInner />
    </MsalProvider>
  );
}

export default function HarnessApp() {
  return AUTH_MODE === "real" ? <RealHarness /> : <MockHarness />;
}
