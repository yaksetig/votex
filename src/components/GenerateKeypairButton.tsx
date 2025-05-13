// src/components/GenerateKeypairButton.tsx
"use client";

import React, { useState } from "react";
import { generateKeypair } from "../services/babyJubjubService";

export default function GenerateKeypairButton() {
  const [loading, setLoading] = useState(false);
  const [keypair, setKeypair] = useState<{
    k: bigint;
    Ax: string;
    Ay: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const { k, Ax, Ay } = await generateKeypair();
      setKeypair({ k, Ax: Ax.toString(), Ay: Ay.toString() });
    } catch (e: any) {
      console.error("Keypair generation failed", e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={onClick}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Keypair"}
      </button>

      {error && <div className="mt-2 text-red-500">Error: {error}</div>}

      {keypair && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p>
            <strong>Private key (k):</strong> {keypair.k}
          </p>
          <p>
            <strong>Public A:</strong> ({keypair.Ax}, {keypair.Ay})
          </p>
        </div>
      )}
    </div>
  );
}
