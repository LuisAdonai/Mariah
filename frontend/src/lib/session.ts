import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { Me } from "@/lib/types";

export function beginSession(me: Me) {
  queryClient.clear();
  queryClient.setQueryData(["me"], me);
}

export async function endSession() {
  try {
    await apiPost<Me>("/auth/logout");
  } finally {
    queryClient.clear();
  }
}
