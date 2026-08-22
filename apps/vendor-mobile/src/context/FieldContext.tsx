import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FieldRoute } from "@indus/shared-types";
import { listFields } from "../api/fields";
import { me } from "../api/auth";
import { useAuth } from "./AuthContext";

interface FieldContextValue {
  myFields: FieldRoute[];
  activeField: FieldRoute | null;
  setActiveFieldId: (id: string) => void;
  loading: boolean;
}

const FieldContext = createContext<FieldContextValue | undefined>(undefined);

export function FieldProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [myFields, setMyFields] = useState<FieldRoute[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setMyFields([]);
      setActiveFieldId(null);
      return;
    }
    setLoading(true);
    Promise.all([listFields(), me()])
      .then(([allFields, user]) => {
        const mine = user.fieldIds.length > 0 ? allFields.filter((f) => user.fieldIds.includes(f.id)) : allFields;
        setMyFields(mine);
        setActiveFieldId((current) => current ?? mine[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [session]);

  const value = useMemo<FieldContextValue>(
    () => ({
      myFields,
      activeField: myFields.find((f) => f.id === activeFieldId) ?? null,
      setActiveFieldId,
      loading,
    }),
    [myFields, activeFieldId, loading],
  );

  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
}

export function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error("useField must be used within FieldProvider");
  return ctx;
}
