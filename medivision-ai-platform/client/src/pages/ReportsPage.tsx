import { Show, SignInButton } from "@clerk/react";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronRight, FileText, Filter, Loader2, Search, ScanLine, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

function firstFinding(findingsJson: string | null) {
  try { const value = JSON.parse(findingsJson || "[]"); return Array.isArray(value) && value[0]?.name ? String(value[0].name) : "No findings yet"; } catch { return "No findings yet"; }
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (status === "failed") return "bg-rose-50 text-rose-700 hover:bg-rose-50";
  return "bg-amber-50 text-amber-700 hover:bg-amber-50";
}

function ReportLibrary() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "processing" | "completed" | "failed">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "finding">("newest");
  const historyQuery = trpc.reports.history.useQuery(undefined, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.reports.delete.useMutation({ onSuccess: async () => { await utils.reports.history.invalidate(); toast.success("Report deleted"); }, onError: error => toast.error(error.message) });
  const reports = useMemo(() => {
    const list = (historyQuery.data || []).filter(report => {
      const matchesSearch = !search || `${report.originalFileName || ""} ${firstFinding(report.findingsJson)} ${report.modelVersion}`.toLowerCase().includes(search.toLowerCase());
      return matchesSearch && (status === "all" || report.status === status);
    });
    return [...list].sort((a, b) => sort === "finding" ? firstFinding(a.findingsJson).localeCompare(firstFinding(b.findingsJson)) : sort === "newest" ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [historyQuery.data, search, sort, status]);

  return <main className="min-h-screen bg-[#f7fafc] text-slate-950"><header className="border-b border-slate-200/80 bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10"><Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Back to workspace</Link><Link href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-cyan-300"><ScanLine className="h-4 w-4" /></span><span className="font-semibold tracking-tight">MediVision <span className="text-cyan-700">AI</span></span></Link></div></header><div className="mx-auto max-w-7xl px-6 py-8 lg:px-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-cyan-700">Report library</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Your analysis reports</h1><p className="mt-3 max-w-xl leading-7 text-slate-500">Review previous reports, inspect model artifacts, and share individual results through expiring secure links.</p></div><Link href="/upload"><Button className="rounded-full bg-slate-900 text-white hover:bg-slate-800">New X-ray</Button></Link></div><div className="mt-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by file name, finding, or model" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" /></div><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-400" /><select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">All statuses</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="failed">Failed</option></select></div><select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="finding">Sort by finding</option></select></div>{historyQuery.isLoading ? <div className="mt-8 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading reports...</div> : reports.length ? <div className="mt-6 space-y-3">{reports.map(report => <div key={report.id} className="group flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md sm:flex-row sm:items-center"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100">{report.originalImageUrl ? <img src={report.originalImageUrl} alt="Report source X-ray" className="h-full w-full object-cover" /> : <FileText className="h-7 w-7 text-cyan-700" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{report.originalFileName || `Study ${report.studyId}`}</p><Badge className={statusClass(report.status)}>{report.status}</Badge></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(report.createdAt).toLocaleString()}</span><span>{firstFinding(report.findingsJson)}</span><span>{report.modelVersion}</span></div></div><div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Delete report" className="text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => { if (window.confirm("Delete this report? Its secure share links will stop working.")) deleteMutation.mutate({ id: report.id }); }} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4" /></Button><Link href={`/reports/${report.id}`}><Button variant="outline" className="rounded-full">View report <ChevronRight className="ml-1 h-4 w-4" /></Button></Link></div></div>)}</div> : <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><FileText className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 text-xl font-semibold">No matching reports</h2><p className="mx-auto mt-2 max-w-md leading-7 text-slate-500">Upload a chest X-ray to create your first processing report, or adjust the search and filters.</p><Link href="/upload"><Button className="mt-6 rounded-full bg-slate-900 text-white">Upload an X-ray</Button></Link></div>}<div className="mt-8 flex items-start gap-3 rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-sm leading-6 text-cyan-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" /><p>Reports are visible only to your account unless you create an expiring secure share link. This is a research prototype and not a medical record.</p></div></div></main>;
}

export default function ReportsPage() {
  return <><Show when="signed-out"><div className="grid min-h-screen place-items-center bg-[#07101f] px-6 text-white"><div className="text-center"><p className="text-lg">Sign in to view your reports.</p><SignInButton mode="modal"><Button className="mt-5 rounded-full bg-cyan-300 text-[#06101d]">Sign in</Button></SignInButton></div></div></Show><Show when="signed-in"><ReportLibrary /></Show></>;
}
