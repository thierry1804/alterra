import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { BordereauRow } from "../lib/payments";
import { useCan } from "./useCan";

export function useBordereaux(
  periodIso: string,
  referenceYear: string | undefined,
  siteId: string,
) {
  const can = useCan();
  return useQuery({
    queryKey: ["bordereaux", periodIso, referenceYear, siteId],
    queryFn: () =>
      api
        .get<{ data: BordereauRow[] }>("/bordereaux", {
          params: { periodIso, referenceYear, siteId: siteId || undefined },
        })
        .then((r) => r.data.data),
    enabled: can("bordereau:lecture") && !!periodIso,
    refetchInterval: 15000,
  });
}
