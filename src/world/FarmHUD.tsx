import React, { useEffect, useState } from "react";
import { economy } from "./EconomyManager";

export const FarmHUD: React.FC = () => {
  const [balance, setBalance] = useState<number>(economy.getBalance());

  useEffect(() => {
    const unsubscribe = economy.subscribe((newBalance) => {
      setBalance(newBalance);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        backgroundColor: "rgba(30, 41, 59, 0.85)",
        color: "#f8fafc",
        padding: "8px 16px",
        borderRadius: "8px",
        border: "2px solid #eab308",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "1.25rem",
        fontWeight: "bold",
        userSelect: "none",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        zIndex: 1000,
      }}
    >
      <span style={{ color: "#22c55e" }}>$</span>
      <span>{balance.toLocaleString()}</span>
    </div>
  );
};