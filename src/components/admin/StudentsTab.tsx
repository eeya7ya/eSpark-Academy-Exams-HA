"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, KeyRound, Trash2, Copy, Check, Users } from "lucide-react";
import {
  type StudentRow,
  inputCls,
  btnPrimary,
  btnSecondary,
} from "./types";
import { Modal } from "./CoursesTab";

export default function StudentsTab() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Credentials to show once after create / reset
  const [credentials, setCredentials] = useState<{
    name: string;
    username: string;
    password: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/students", {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStudents(data.students);
        setError(null);
      } else setError(data.error || `Failed to load students (HTTP ${res.status})`);
    } catch {
      setError(
        "Could not reach the server. Check the database configuration and retry."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setName("");
        setUsername("");
        setPassword("");
        setCredentials({
          name: data.student.name,
          username: data.student.username,
          password: data.password,
        });
        await load();
      } else {
        alert(data.error || "Failed to create student");
      }
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (student: StudentRow) => {
    if (!confirm(`Generate a new password for ${student.name}?`)) return;
    const res = await fetch(`/api/admin/students/${student.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    const data = await res.json();
    if (res.ok && data.password) {
      setCredentials({
        name: student.name,
        username: student.username,
        password: data.password,
      });
    } else {
      alert(data.error || "Failed to reset password");
    }
  };

  const remove = async (student: StudentRow) => {
    if (
      !confirm(
        `Delete student "${student.name}" and all their exam results? This cannot be undone.`
      )
    )
      return;
    const res = await fetch(`/api/admin/students/${student.id}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
    else alert("Failed to delete student");
  };

  const copyCredentials = () => {
    if (!credentials) return;
    const text = `eSpark Academy exam login\nUsername: ${credentials.username}\nPassword: ${credentials.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2000);
    });
  };

  if (loading) {
    return <div className="h-48 rounded-2xl animate-shimmer bg-white" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Students</h2>
          <p className="text-xs text-[#9b958c] mt-0.5">
            Each student uses their username and password to enter any exam
            link you share with them.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className={btnPrimary}>
          <Plus className="w-4 h-4" />
          New student
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[#c2554d]/10 border border-[#c2554d]/20 text-[#c2554d] text-sm mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="flex-1 min-w-[200px]">{error}</span>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              load();
            }}
            className="shrink-0 px-3 py-1.5 rounded-md bg-[#c2554d] text-white text-xs font-semibold hover:bg-[#a8463f] transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {students.length === 0 && !error ? (
        <div className="bg-white border border-[#e6e1da] rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-[#ded7cd] mx-auto mb-3" />
          <p className="text-sm text-[#76716a] font-medium">No students yet</p>
          <p className="text-xs text-[#9b958c] mt-1">
            Create student accounts and share the credentials with them.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#e6e1da] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0ebe5] text-left text-[11px] uppercase tracking-wide text-[#9b958c]">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Username</th>
                  <th className="px-4 py-3 font-semibold">Exams taken</th>
                  <th className="px-4 py-3 font-semibold">Added</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[#f0ebe5] last:border-0 hover:bg-[#faf8f5]"
                  >
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-[#76716a] font-mono text-xs">
                      {s.username}
                    </td>
                    <td className="px-4 py-3 text-[#76716a]">{s.attemptCount}</td>
                    <td className="px-4 py-3 text-[#9b958c] text-xs">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => resetPassword(s)}
                          className="p-2 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] transition cursor-pointer"
                          title="Reset password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          className="p-2 rounded-lg text-[#c2554d] hover:bg-[#c2554d]/10 transition cursor-pointer"
                          title="Delete student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create student modal */}
      {showForm && (
        <Modal title="New student" onClose={() => setShowForm(false)}>
          <form onSubmit={create} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Full name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ahmed Khaled"
                required
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ahmed.khaled"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Password (leave empty to auto-generate)
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters, or leave empty"
                className={inputCls}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Creating…" : "Create student"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Credentials modal — shown once */}
      {credentials && (
        <Modal
          title={`Login details for ${credentials.name}`}
          onClose={() => setCredentials(null)}
        >
          <p className="text-xs text-[#9b958c] mb-4">
            Save these now — the password is not shown again (you can always
            reset it later).
          </p>
          <div className="bg-[#faf8f5] border border-[#e6e1da] rounded-xl p-4 font-mono text-sm space-y-2">
            <div>
              <span className="text-[#9b958c] text-xs">Username:</span>{" "}
              {credentials.username}
            </div>
            <div>
              <span className="text-[#9b958c] text-xs">Password:</span>{" "}
              {credentials.password}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={copyCredentials} className={btnSecondary}>
              {copiedCreds ? (
                <>
                  <Check className="w-4 h-4 text-[#4f7a58]" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy credentials
                </>
              )}
            </button>
            <button onClick={() => setCredentials(null)} className={btnPrimary}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
