import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Role, type FieldRoute, type User } from "@indus/shared-types";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Field, inputClass } from "../components/form/Field";
import { Modal } from "../components/Modal";
import { devResetDemoData } from "../mock/api";
import { listFields, upsertField } from "../api/fields";
import { inviteUser, listUsers } from "../api/users";

type Tab = "profile" | "fields" | "users";

const PROFILE_KEY = "indus-erp-admin-web:company-profile:v1";
interface CompanyProfile {
  shopName: string;
  gstNumber: string;
  address: string;
}
function loadProfile(): CompanyProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { shopName: "Pro-Ledger Furniture & Household Goods", gstNumber: "", address: "" };
}

function CompanyProfileTab() {
  const [profile, setProfile] = useState<CompanyProfile>(loadProfile);
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl rounded-lg border border-border bg-surface-lowest p-container-p">
      <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border-outline bg-surface-low text-body-sm text-ink-variant">
        Logo
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Shop Name" required>
          <input className={inputClass} value={profile.shopName} onChange={(e) => setProfile({ ...profile, shopName: e.target.value })} />
        </Field>
        <Field label="GST Details">
          <input className={inputClass} value={profile.gstNumber} onChange={(e) => setProfile({ ...profile, gstNumber: e.target.value })} />
        </Field>
        <Field label="Primary Address">
          <input className={inputClass} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={save}>Save Changes</Button>
          {saved && <span className="text-body-sm text-action">Saved.</span>}
        </div>
      </div>
    </div>
  );
}

function FieldRoutesTab() {
  const queryClient = useQueryClient();
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields });
  const [modal, setModal] = useState<{ open: boolean; field: FieldRoute | null }>({ open: false, field: null });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setModal({ open: true, field: null })}>Add Route</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-lowest">
        <table className="w-full text-table-data">
          <thead className="bg-table-header text-label-bold uppercase text-ink-variant">
            <tr>
              <th className="px-4 py-3 text-left">Route ID</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields?.map((f) => (
              <tr key={f.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">{f.code}</td>
                <td className="px-4 py-3">{f.description}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={f.active ? "ACTIVE" : "INACTIVE"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-primary hover:underline" onClick={() => setModal({ open: true, field: f })}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FieldRouteModal
        open={modal.open}
        field={modal.field}
        onClose={() => setModal({ open: false, field: null })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["fields"] })}
      />
    </div>
  );
}

function FieldRouteModal({
  open,
  field,
  onClose,
  onSaved,
}: {
  open: boolean;
  field: FieldRoute | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(field?.code ?? "");
  const [description, setDescription] = useState(field?.description ?? "");
  const [active, setActive] = useState(field?.active ?? true);

  const mutation = useMutation({
    mutationFn: upsertField,
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={field ? "Edit Field Route" : "Add Field Route"}
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate({ id: field?.id, code, description, active })}
            disabled={mutation.isPending || !code.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Route ID (Field Code)" required>
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. C1" />
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-body-sm text-ink-variant">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-border" />
          Active
        </label>
      </div>
    </Modal>
  );
}

function UserManagementTab() {
  const queryClient = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: listFields });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.Collector);
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [createdInvite, setCreatedInvite] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  const mutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setInviteOpen(false);
      setCreatedInvite({ name: user.name, email: user.email, tempPassword: user.tempPassword });
      setName("");
      setEmail("");
      setFieldIds([]);
    },
  });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setInviteOpen(true)}>Invite User</Button>
      </div>
      {createdInvite && (
        <div className="mb-3 rounded-lg border border-border-outline bg-surface-low p-4 text-body-sm">
          <div className="font-semibold text-ink">
            {createdInvite.name} was created. Share this temporary password — there's no email delivery yet, so it won't reach them
            automatically:
          </div>
          <div className="mt-1 flex items-center gap-3">
            <code className="rounded bg-surface-lowest px-2 py-1 font-mono text-body-md">{createdInvite.tempPassword}</code>
            <span className="text-ink-variant">{createdInvite.email}</span>
            <button className="ml-auto text-primary hover:underline" onClick={() => setCreatedInvite(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-lowest">
        <table className="w-full text-table-data">
          <thead className="bg-table-header text-label-bold uppercase text-ink-variant">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Fields</th>
              <th className="px-4 py-3 text-left">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: User) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role === Role.Admin ? "Admin" : "Collector"}</td>
                <td className="px-4 py-3">{u.fieldIds.map((id) => fields?.find((f) => f.id === id)?.code).join(", ") || "All"}</td>
                <td className="px-4 py-3">{u.lastActiveAt ? u.lastActiveAt.slice(0, 10) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite User"
        width="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate({ name, email, role, fieldIds })}
              disabled={mutation.isPending || !name.trim() || !email.trim()}
            >
              Send Invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name" required>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" required>
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Role" required>
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value={Role.Collector}>Collector</option>
              <option value={Role.Admin}>Admin</option>
            </select>
          </Field>
          {role === Role.Collector && (
            <Field label="Assigned Fields">
              <div className="flex flex-wrap gap-3">
                {fields?.map((f) => (
                  <label key={f.id} className="flex items-center gap-1.5 text-body-sm">
                    <input
                      type="checkbox"
                      checked={fieldIds.includes(f.id)}
                      onChange={(e) =>
                        setFieldIds((prev) => (e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)))
                      }
                    />
                    {f.code}
                  </label>
                ))}
              </div>
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [resetDone, setResetDone] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Company Profile" },
    { id: "fields", label: "Field Routes" },
    { id: "users", label: "User Management" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-body-md ${
              tab === t.id ? "border-b-2 border-primary font-semibold text-primary" : "text-ink-variant hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <CompanyProfileTab />}
      {tab === "fields" && <FieldRoutesTab />}
      {tab === "users" && <UserManagementTab />}

      <div className="mt-8 max-w-xl rounded-lg border border-dashed border-border-outline p-4 text-body-sm text-ink-variant">
        <div className="mb-2 font-semibold text-ink">Developer</div>
        <p className="mb-3">
          This app runs against the real API and database. This button only resets the separate local demo-data sandbox
          (browser localStorage) used before the backend existed — it has no effect on real data.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            if (!confirm("Reset the local demo-data sandbox? This cannot be undone.")) return;
            await devResetDemoData();
            setResetDone(true);
            window.location.reload();
          }}
        >
          Reset Local Demo Sandbox
        </Button>
        {resetDone && <span className="ml-3 text-action">Reset — reloading…</span>}
      </div>
    </div>
  );
}
