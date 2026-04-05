/**
 * WebAuthn + PRF Extension Test Harness
 *
 * Drop this page into World App's mini-app WebView to find out exactly
 * which WebAuthn capabilities are available.
 *
 * Tests performed (in order):
 * 1. navigator.credentials exists?
 * 2. isUserVerifyingPlatformAuthenticatorAvailable()?
 * 3. Create a passkey (with PRF requested)
 * 4. PRF enabled on creation?
 * 5. Authenticate with the passkey (with PRF eval)
 * 6. PRF output returned?
 * 7. Determinism check — authenticate again, compare PRF output
 */

import React, { useState, useRef } from "react";

type Status = "idle" | "running" | "pass" | "fail" | "skip";

interface TestResult {
  name: string;
  status: Status;
  detail?: string;
}

const INITIAL_TESTS: TestResult[] = [
  { name: "navigator.credentials API", status: "idle" },
  { name: "Platform authenticator available", status: "idle" },
  { name: "Create passkey (resident key)", status: "idle" },
  { name: "PRF extension enabled on creation", status: "idle" },
  { name: "Authenticate + PRF eval", status: "idle" },
  { name: "PRF output returned (32 bytes)", status: "idle" },
  { name: "PRF determinism (same output twice)", status: "idle" },
];

const PRF_SALT = new TextEncoder().encode("votex:webauthn-test:v1");

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const WebAuthnTest: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>(INITIAL_TESTS);
  const [running, setRunning] = useState(false);
  const [env, setEnv] = useState<Record<string, string>>({});
  const credentialIdRef = useRef<string | null>(null);

  const update = (index: number, status: Status, detail?: string) => {
    setTests((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status, detail };
      return next;
    });
  };

  const collectEnv = () => {
    const info: Record<string, string> = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      hasCredentials: String(!!navigator.credentials),
      hasPublicKeyCredential: String(typeof PublicKeyCredential !== "undefined"),
    };
    // Detect if we're in a WebView
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("wv") || ua.includes("webview")) {
      info.webview = "detected (UA hint)";
    } else if (!(window as Record<string, unknown>).chrome && ua.includes("android")) {
      info.webview = "likely (Android, no chrome object)";
    } else if (
      (window as Record<string, unknown>).webkit &&
      (window as Record<string, unknown>).webkit !== undefined &&
      ua.includes("iphone")
    ) {
      info.webview = "likely (iOS WKWebView)";
    } else {
      info.webview = "not detected";
    }
    setEnv(info);
    return info;
  };

  const makeChallenge = (): ArrayBuffer => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const buf = new ArrayBuffer(32);
    new Uint8Array(buf).set(bytes);
    return buf;
  };

  const makeSaltBuffer = (): ArrayBuffer => {
    const buf = new ArrayBuffer(PRF_SALT.length);
    new Uint8Array(buf).set(PRF_SALT);
    return buf;
  };

  const runAuthWithPRF = async (credId: string): Promise<ArrayBuffer | null> => {
    const credBuf = base64ToBuf(credId);
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: makeChallenge(),
        allowCredentials: [{ type: "public-key", id: credBuf }],
        userVerification: "required",
        timeout: 60000,
        extensions: {
          prf: { eval: { first: makeSaltBuffer() } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return null;

    const ext = assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer } };
    };
    return ext.prf?.results?.first ?? null;
  };

  const runTests = async () => {
    setRunning(true);
    setTests(INITIAL_TESTS.map((t) => ({ ...t, status: "idle" })));
    collectEnv();

    let idx = 0;

    // Test 0: navigator.credentials
    update(idx, "running");
    if (!navigator.credentials) {
      update(idx, "fail", "navigator.credentials is undefined");
      setRunning(false);
      for (let j = idx + 1; j < INITIAL_TESTS.length; j++) update(j, "skip", "Blocked by previous failure");
      return;
    }
    update(idx, "pass", "Available");
    idx++;

    // Test 1: Platform authenticator
    update(idx, "running");
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        update(idx, "pass", "Platform authenticator available");
      } else {
        update(idx, "fail", "No platform authenticator");
        setRunning(false);
        for (let j = idx + 1; j < INITIAL_TESTS.length; j++) update(j, "skip", "Blocked by previous failure");
        return;
      }
    } catch (e) {
      update(idx, "fail", String(e));
      setRunning(false);
      for (let j = idx + 1; j < INITIAL_TESTS.length; j++) update(j, "skip", "Blocked by previous failure");
      return;
    }
    idx++;

    // Test 2: Create passkey
    update(idx, "running");
    let prfEnabledOnCreate = false;
    try {
      const userId = new ArrayBuffer(32);
      new Uint8Array(userId).set(crypto.getRandomValues(new Uint8Array(32)));

      const credential = (await navigator.credentials.create({
        publicKey: {
          rp: { name: "Votex WebAuthn Test", id: window.location.hostname },
          user: {
            id: userId,
            name: "webauthn-test",
            displayName: "WebAuthn Test User",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "required",
            userVerification: "required",
          },
          timeout: 60000,
          challenge: makeChallenge(),
          extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        update(idx, "fail", "navigator.credentials.create() returned null");
        setRunning(false);
        for (let j = idx + 1; j < INITIAL_TESTS.length; j++) update(j, "skip");
        return;
      }

      const credId = bufToBase64(credential.rawId);
      credentialIdRef.current = credId;

      const ext = credential.getClientExtensionResults() as {
        prf?: { enabled?: boolean };
      };
      prfEnabledOnCreate = !!ext.prf?.enabled;

      update(idx, "pass", `credentialId: ${credId.slice(0, 20)}...`);
    } catch (e) {
      update(idx, "fail", String(e));
      setRunning(false);
      for (let j = idx + 1; j < INITIAL_TESTS.length; j++) update(j, "skip");
      return;
    }
    idx++;

    // Test 3: PRF enabled on creation
    update(idx, "running");
    if (prfEnabledOnCreate) {
      update(idx, "pass", "prf.enabled = true");
    } else {
      update(idx, "fail", "prf.enabled is false or missing — PRF not supported by this authenticator/environment");
      // Continue anyway — some implementations only return PRF results on .get() even if .create() doesn't report enabled
    }
    idx++;

    // Test 4: Authenticate + PRF eval
    update(idx, "running");
    let prfOutput1: ArrayBuffer | null = null;
    try {
      prfOutput1 = await runAuthWithPRF(credentialIdRef.current!);
      update(idx, "pass", "Authentication succeeded");
    } catch (e) {
      update(idx, "fail", String(e));
      setRunning(false);
      for (let j = idx + 1; j < INITIAL_TESTS.length; j++) update(j, "skip");
      return;
    }
    idx++;

    // Test 5: PRF output returned
    update(idx, "running");
    if (prfOutput1 && prfOutput1.byteLength === 32) {
      update(idx, "pass", `32 bytes: ${bufToHex(prfOutput1).slice(0, 32)}...`);
    } else if (prfOutput1) {
      update(idx, "fail", `Unexpected length: ${prfOutput1.byteLength} bytes`);
      setRunning(false);
      update(idx + 1, "skip");
      return;
    } else {
      update(idx, "fail", "No PRF output in extension results");
      setRunning(false);
      update(idx + 1, "skip");
      return;
    }
    idx++;

    // Test 6: Determinism — run auth again, compare
    update(idx, "running");
    try {
      const prfOutput2 = await runAuthWithPRF(credentialIdRef.current!);
      if (!prfOutput2) {
        update(idx, "fail", "Second authentication returned no PRF output");
      } else {
        const hex1 = bufToHex(prfOutput1!);
        const hex2 = bufToHex(prfOutput2);
        if (hex1 === hex2) {
          update(idx, "pass", "Both outputs match — PRF is deterministic");
        } else {
          update(idx, "fail", `Outputs differ!\n  1: ${hex1.slice(0, 32)}...\n  2: ${hex2.slice(0, 32)}...`);
        }
      }
    } catch (e) {
      update(idx, "fail", String(e));
    }

    setRunning(false);
  };

  const statusIcon = (s: Status) => {
    switch (s) {
      case "pass": return "\u2705";
      case "fail": return "\u274C";
      case "running": return "\u23F3";
      case "skip": return "\u23ED\uFE0F";
      default: return "\u2B1C";
    }
  };

  const allPassed = tests.every((t) => t.status === "pass");
  const anyFailed = tests.some((t) => t.status === "fail");

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        WebAuthn + PRF Test Harness
      </h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
        Tests whether this environment supports passkey creation and PRF-based secret derivation.
      </p>

      <button
        onClick={runTests}
        disabled={running}
        style={{
          width: "100%",
          padding: "14px 0",
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 12,
          border: "none",
          background: running ? "#999" : "#1a73e8",
          color: "#fff",
          cursor: running ? "not-allowed" : "pointer",
          marginBottom: 20,
        }}
      >
        {running ? "Running tests..." : "Run WebAuthn + PRF Tests"}
      </button>

      {/* Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tests.map((t, i) => (
          <div
            key={i}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background:
                t.status === "pass" ? "#e6f4ea" :
                t.status === "fail" ? "#fce8e6" :
                t.status === "running" ? "#fff8e1" :
                "#f5f5f5",
              border: "1px solid",
              borderColor:
                t.status === "pass" ? "#34a853" :
                t.status === "fail" ? "#ea4335" :
                t.status === "running" ? "#f9ab00" :
                "#ddd",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{statusIcon(t.status)}</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</span>
            </div>
            {t.detail && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#555", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                {t.detail}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Verdict */}
      {!running && (allPassed || anyFailed) && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            background: allPassed ? "#e6f4ea" : "#fce8e6",
            border: `2px solid ${allPassed ? "#34a853" : "#ea4335"}`,
            textAlign: "center",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {allPassed
            ? "ALL TESTS PASSED — PRF works here. Existing key derivation flow is compatible."
            : "SOME TESTS FAILED — See above for details. PRF may not work in this environment."}
        </div>
      )}

      {/* Environment info */}
      {Object.keys(env).length > 0 && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Environment Details
          </summary>
          <pre style={{ fontSize: 11, background: "#f5f5f5", padding: 12, borderRadius: 8, overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(env, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default WebAuthnTest;
