import { Loader2, ShieldAlert } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ReportDocument } from "./ReportPage";

export default function SharedReportPage() {
  const [match, params] = useRoute("/shared-report/:token");
  const token = params?.token || "";
  const query = trpc.reports.public.useQuery({ token }, { enabled: Boolean(match && token), retry: false });
  if (query.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7fafc]"><Loader2 className="h-8 w-8 animate-spin text-cyan-700" /></div>;
  if (query.error || !query.data) return <div className="grid min-h-screen place-items-center bg-[#f7fafc] px-6 text-center"><div><ShieldAlert className="mx-auto h-10 w-10 text-amber-500" /><h1 className="mt-4 text-2xl font-semibold">Secure link unavailable</h1><p className="mt-2 max-w-md text-slate-500">This report link has expired, been revoked, or does not exist.</p><Link href="/"><Button className="mt-5 rounded-full bg-slate-900 text-white">Back to MediVision AI</Button></Link></div></div>;
  return <ReportDocument report={query.data.report} publicMode />;
}
