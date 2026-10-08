import { useCallback, useEffect, useState } from "react";
import { getCurrentRep, onAuthChange } from "../lib/auth.js";

/** The signed-in rep, or null for a student. */
export function useSession() {
  const [rep, setRep] = useState(null);
  const [checked, setChecked] = useState(false);

  const sync = useCallback(async () => {
    const current = await getCurrentRep();
    setRep(current);
    setChecked(true);
  }, []);

  useEffect(() => {
    sync();
    return onAuthChange(sync);
  }, [sync]);

  return { rep, isRep: Boolean(rep), checked };
}
