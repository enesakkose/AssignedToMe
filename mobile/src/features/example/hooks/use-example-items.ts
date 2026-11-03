import { getExampleItems } from "@/features/example/api/example-api";
import { EXAMPLE_QUERY_KEYS } from "@/features/example/constants";
import { useQuery } from "@tanstack/react-query";

export function useExampleItems() {
  return useQuery({
    queryFn: getExampleItems,
    queryKey: EXAMPLE_QUERY_KEYS.items,
  });
}
