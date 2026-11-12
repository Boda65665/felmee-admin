import { useQuery } from "@tanstack/react-query";

import { ApiError, api, unwrap } from "./client";
import { getEmployee } from "./employees";
import type { components } from "./schema";

export type CurrentUser = components["schemas"]["ProfileUser"];

export const getCurrentUser = async (): Promise<CurrentUser> => {
  // /api/user requires USER authority; ADMIN has a separate employee API.
  const response = await api.GET("/api/admin/employees/me/permissions");
  const own = unwrap(response);
  const identity: CurrentUser = { id: own.user_id, type_account: "ADMIN" };
  const canReadEmployees = own.permissions.some(
    (permission) => permission.section === "ROLES" && permission.access_level !== "NONE",
  );
  if (!canReadEmployees) return identity;
  try {
    const employee = await getEmployee(own.user_id);
    return {
      ...identity,
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone,
    };
  } catch (error) {
    // Rights can change between the two calls; the known account ID stays valid.
    if (error instanceof ApiError && error.status === 403) return identity;
    throw error;
  }
};

export const useCurrentUser = (enabled = true) =>
  useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    enabled,
  });
