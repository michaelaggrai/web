"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { currentAdminEmail, normaliseEmail } from "@/lib/admin";

// Server Actions are reachable by direct POST, not only through our UI (Next's
// own docs call this out), so EVERY action re-verifies admin status itself. The
// page's check protects nothing here.

export async function addAdmin(formData: FormData): Promise<void> {
  const me = await currentAdminEmail();
  if (!me) throw new Error("Not authorised");

  const email = normaliseEmail(formData.get("email"));
  if (!email) throw new Error("That doesn't look like an email address");

  const { error } = await createAdminClient()
    .from("admin_users").insert({ email, added_by: me });
  // 23505 = already an admin; that's a no-op, not a failure worth shouting about.
  if (error && error.code !== "23505") throw new Error("Could not add that address");

  revalidatePath("/admin");
}

export async function removeAdmin(formData: FormData): Promise<void> {
  const me = await currentAdminEmail();
  if (!me) throw new Error("Not authorised");

  const email = normaliseEmail(formData.get("email"));
  if (!email) throw new Error("Invalid address");

  // Two lockout guards. Removing yourself is almost always a slip, and emptying
  // the table entirely would make /admin unreachable for everyone — recoverable
  // only by a manual DB write.
  if (email === me) throw new Error("You can't remove your own access");

  const admin = createAdminClient();
  const { count } = await admin.from("admin_users").select("email", { count: "exact", head: true });
  if ((count ?? 0) <= 1) throw new Error("Can't remove the last admin");

  const { error } = await admin.from("admin_users").delete().eq("email", email);
  if (error) throw new Error("Could not remove that address");

  revalidatePath("/admin");
}
