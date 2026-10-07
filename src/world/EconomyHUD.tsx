import type React from "react";
import { useEffect, useState } from "react";
import { economy } from "./EconomyManager";

export const EconomyHUD: React.FC = () => {
  const [balance, setBalance] = useState<number>(economy.getBalance());

  useEffect(() => {
    const unsubscribe = economy.subscribe((newBalance) => {
      setBalance(newBalance);
    });
    return () => unsubscribe();
  }, []);

  return (
    <span className="farm-map-balance" data-testid="farm-balance">
      <span className="farm-map-balance-symbol">$</span>
      {balance.toLocaleString()}
    </span>
  );
};
