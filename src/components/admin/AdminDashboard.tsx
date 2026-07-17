"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  BarChart3,
  LogOut,
} from "lucide-react";
import CoursesTab from "./CoursesTab";
import StudentsTab from "./StudentsTab";
import ResultsTab from "./ResultsTab";

type Tab = "courses" | "students" | "results";

const TABS: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: "courses", label: "Courses & Exams", icon: BookOpen },
  { key: "students", label: "Students", icon: Users },
  { key: "results", label: "Results", icon: BarChart3 },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("courses");
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#edeae5] text-[#2b2f30]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#edeae5]/90 backdrop-blur border-b border-[#ded7cd]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5b7884] text-white flex items-center justify-center font-bold">
              e
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">
                eSpark Academy
              </h1>
              <p className="text-[11px] text-[#9b958c] leading-tight">
                Exams control panel
              </p>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 bg-white border border-[#e6e1da] rounded-xl p-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  tab === key
                    ? "bg-[#5b7884] text-white"
                    : "text-[#76716a] hover:bg-[#f4f0ec]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-medium text-[#76716a] hover:text-[#c2554d] transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden border-t border-[#ded7cd] px-4 py-2 flex gap-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                tab === key
                  ? "bg-[#5b7884] text-white"
                  : "text-[#76716a] bg-white border border-[#e6e1da]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === "courses" && <CoursesTab />}
        {tab === "students" && <StudentsTab />}
        {tab === "results" && <ResultsTab />}
      </main>
    </div>
  );
}
