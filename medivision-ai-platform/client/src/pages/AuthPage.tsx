import { SignIn, SignUp } from "@clerk/react";
import { ScanLine, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export default function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignIn = mode === "sign-in";
  return (
    <main className="min-h-screen bg-[#07101f] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300 text-[#06101d]"><ScanLine className="h-5 w-5" /></span><span className="font-semibold tracking-tight">MediVision <span className="text-cyan-300">AI</span></span></Link><div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-cyan-300" />Secure authentication by Clerk</div></div>
      <div className="mx-auto grid max-w-6xl gap-12 py-16 lg:grid-cols-[1fr_420px] lg:items-center"><div className="hidden lg:block"><p className="text-sm font-semibold uppercase tracking-[.24em] text-cyan-300">Your research workspace</p><h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.06] tracking-[-.04em]">A safer place to explore imaging signals.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">Create a secure account to save studies, revisit reports, and keep your model workflow organized.</p></div><div className="rounded-[2rem] border border-white/10 bg-white/[.06] p-2 shadow-2xl shadow-cyan-950/20"><div className="rounded-[1.5rem] bg-white p-2">{isSignIn ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" /> : <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />}</div></div></div>
    </main>
  );
}
