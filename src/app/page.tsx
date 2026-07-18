import Image from "next/image";
import Link from "next/link";
import { GraduationCap, Link2, Award, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="relative w-full max-w-2xl text-center">
        <Image
          src="/espark-logo-on-dark.png"
          alt="eSpark"
          width={220}
          height={70}
          priority
          className="mx-auto mb-8 h-auto w-48 sm:w-56"
        />

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
          eSpark <span className="gradient-text">Academy</span> Exams
        </h1>
        <p className="text-[var(--primary-light)] text-base sm:text-lg max-w-xl mx-auto mb-12">
          Interactive quizzes for eSpark Academy courses. Open the exam link
          your instructor sent you, sign in with your student account and
          start your exam.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 text-left mb-12">
          <div className="glass rounded-2xl p-5">
            <Link2 className="w-6 h-6 text-[var(--primary-light)] mb-3" />
            <h3 className="font-semibold text-sm mb-1">Open your link</h3>
            <p className="text-xs text-[var(--primary-light)] leading-relaxed">
              Each exam has a private link shared by your instructor.
            </p>
          </div>
          <div className="glass rounded-2xl p-5">
            <GraduationCap className="w-6 h-6 text-[var(--accent-light)] mb-3" />
            <h3 className="font-semibold text-sm mb-1">Take the exam</h3>
            <p className="text-xs text-[var(--primary-light)] leading-relaxed">
              Answer interactive questions and see your mark instantly.
            </p>
          </div>
          <div className="glass rounded-2xl p-5">
            <Award className="w-6 h-6 text-[var(--accent-light)] mb-3" />
            <h3 className="font-semibold text-sm mb-1">Get certified</h3>
            <p className="text-xs text-[var(--primary-light)] leading-relaxed">
              Pass the exam to download your lecture certificate.
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--primary-light)]/70">
          Don&apos;t have an exam link or account? Contact your eSpark Academy
          instructor.
        </p>

        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 mt-10 text-xs text-[var(--primary-light)]/50 hover:text-[var(--primary-light)] transition"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Instructor dashboard
        </Link>
      </div>
    </div>
  );
}
