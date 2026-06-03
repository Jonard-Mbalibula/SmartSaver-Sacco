"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="btn-logout" title="Sign out">
        <LogOut size={15} aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}
