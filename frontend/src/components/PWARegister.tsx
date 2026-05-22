"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/swRegister";

export default function PWARegister() {
  useEffect(() => {
    // Only run registration in browser environment
    if (typeof window !== "undefined") {
      registerServiceWorker();
    }
  }, []);

  return null;
}
