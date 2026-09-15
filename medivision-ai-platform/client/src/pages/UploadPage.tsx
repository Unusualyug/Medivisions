import { Show, SignInButton } from "@clerk/react";
import { useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, FileImage, History, ImagePlus, Loader2, RefreshCw, ScanLine, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type QualityStatus = "pass" | "review";
type SelectedImage = { file: File; previewUrl: string; dataUrl: string; width: number; height: number; qualityStatus: QualityStatus; qualityNote: string };

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function inspectImage(file: File): Promise<{ dataUrl: string; width: number; height: number; qualityStatus: QualityStatus; qualityNote: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onerror = () => reject(new Error("This file is not a readable image."));
      image.onload = () => {
        let qualityStatus: QualityStatus = "pass";
        let qualityNote = "Dimensions and basic contrast look suitable for analysis.";
        if (image.width < 256 || image.height < 256) {
          qualityStatus = "review";
          qualityNote = "The image is small; review image quality before analysis.";
        } else {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context?.drawImage(image, 0, 0, 64, 64);
            const pixels = context?.getImageData(0, 0, 64, 64).data;
            if (pixels) {
              const values: number[] = [];
              for (let index = 0; index < pixels.length; index += 4) values.push((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3);
              const average = values.reduce((sum, value) => sum + value, 0) / values.length;
              const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
              if (average < 8 || average > 248 || variance < 18) {
                qualityStatus = "review";
                qualityNote = "The image has very low contrast or extreme brightness; review it before analysis.";
              }
            }
          } catch {
            qualityStatus = "review";
            qualityNote = "Automatic quality screening was unavailable; review the image manually.";
          }
        }
        resolve({ dataUrl, width: image.width, height: image.height, qualityStatus, qualityNote });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function UploadWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "checking" | "uploading" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const historyQuery = trpc.xray.history.useQuery(undefined, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const createReportMutation = trpc.reports.create.useMutation();
  const uploadMutation = trpc.xray.upload.useMutation({
    onSuccess: async (study) => {
      await utils.xray.history.invalidate();
      setProgress(100);
      setPhase("saved");
      setMessage("Image saved securely. Creating your processing report...");
      toast.success("X-ray uploaded successfully");
      try {
        const report = await createReportMutation.mutateAsync({ studyId: study.id });
        navigate(`/reports/${report.id}`);
      } catch {
        setMessage("Image saved, but the processing report could not be created yet. You can retry from your upload history.");
        toast.error("Report creation is temporarily unavailable");
      }
    },
    onError: (error) => {
      setPhase("error");
      setMessage(error.message || "Upload failed. Please try again.");
      toast.error(error.message || "Upload failed");
    },
  });
  const removeMutation = trpc.xray.remove.useMutation({
    onSuccess: async () => {
      await utils.xray.history.invalidate();
      toast.success("Upload removed from your history");
    },
    onError: (error) => toast.error(error.message || "Could not remove this upload"),
  });

  const hasUpload = phase === "saved";
  const uploadLabel = useMemo(() => {
    if (phase === "checking") return "Checking image quality";
    if (phase === "uploading") return "Uploading securely";
    if (phase === "saved") return "Upload complete";
    return "Ready for analysis";
  }, [phase]);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setMessage("");
    setPhase("checking");
    setProgress(12);
    if (!ACCEPTED_TYPES.has(file.type)) {
      setPhase("error");
      setMessage("Only JPG, JPEG, and PNG files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase("error");
      setMessage("The image must be smaller than 10 MB.");
      return;
    }
    try {
      const inspected = await inspectImage(file);
      setSelected({ file, previewUrl: URL.createObjectURL(file), ...inspected });
      setProgress(28);
      setPhase("idle");
      setMessage(inspected.qualityNote);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "The image could not be inspected.");
    }
  };

  const resetSelection = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (selected) URL.revokeObjectURL(selected.previewUrl);
    setSelected(null);
    setProgress(0);
    setPhase("idle");
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    if (!selected || uploadMutation.isPending) return;
    setPhase("uploading");
    setMessage("Encrypting the image and saving it to your private workspace.");
    setProgress(42);
    progressTimerRef.current = setInterval(() => setProgress(value => Math.min(value + 3, 88)), 350);
    try {
      await uploadMutation.mutateAsync({
        fileName: selected.file.name,
        mimeType: selected.file.type as "image/jpeg" | "image/png",
        sizeBytes: selected.file.size,
        width: selected.width,
        height: selected.height,
        qualityStatus: selected.qualityStatus,
        dataUrl: selected.dataUrl,
      });
    } finally {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void chooseFile(event.dataTransfer.files?.[0]);
  };

  return <main className="min-h-screen bg-[#f7fafc] text-slate-950"><header className="border-b border-slate-200/80 bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10"><Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Back to workspace</Link><Link href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-cyan-300"><ScanLine className="h-4 w-4" /></span><span className="font-semibold tracking-tight">MediVision <span className="text-cyan-700">AI</span></span></Link></div></header><div className="mx-auto max-w-7xl px-6 py-8 lg:px-10"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-cyan-700">New study</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Upload a chest X-ray</h1><p className="mt-3 leading-7 text-slate-500">Add one image to your private workspace. We will validate the file and keep it ready for the next analysis step.</p></div><div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start"><section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Image upload</h2><p className="mt-1 text-sm text-slate-500">JPG, JPEG, or PNG · maximum 10 MB</p></div><Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Private</Badge></div>{!selected ? <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={onDrop} className={`mt-6 grid min-h-[290px] cursor-pointer place-items-center rounded-3xl border-2 border-dashed p-8 text-center transition ${dragActive ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-slate-50/80 hover:border-cyan-300 hover:bg-cyan-50/40"}`}><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-100 text-cyan-700"><UploadCloud className="h-7 w-7" /></div><h3 className="mt-5 text-lg font-semibold">Drag and drop your X-ray here</h3><p className="mt-2 text-sm text-slate-500">or choose a file from your device</p><Button type="button" className="mt-5 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={event => { event.stopPropagation(); inputRef.current?.click(); }}>Choose image</Button></div></div> : <div className="mt-6"><div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950"><img src={selected.previewUrl} alt="Selected chest X-ray preview" className="max-h-[360px] w-full object-contain" /></div><div className="mt-4 flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-medium">{selected.file.name}</p><p className="mt-1 text-sm text-slate-500">{formatBytes(selected.file.size)} · {selected.width} × {selected.height}px</p></div><Button type="button" variant="outline" className="shrink-0 rounded-full" onClick={resetSelection}><RefreshCw className="mr-2 h-4 w-4" />Replace</Button></div><div className={`mt-4 flex gap-3 rounded-2xl border p-4 text-sm ${selected.qualityStatus === "pass" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{selected.qualityStatus === "pass" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}<div><p className="font-semibold">{selected.qualityStatus === "pass" ? "Basic quality check passed" : "Review image quality"}</p><p className="mt-1 leading-6">{selected.qualityNote}</p></div></div></div>}<input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png" onChange={event => void chooseFile(event.target.files?.[0])} />{message && !selected && <div className="mt-4 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{message}</div>}{selected && <div className="mt-6"><div className="flex items-center justify-between text-sm"><span className="font-medium">{uploadLabel}</span><span className="text-slate-500">{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-300 ${phase === "error" ? "bg-rose-500" : phase === "saved" ? "bg-emerald-500" : "bg-cyan-500"}`} style={{ width: `${progress}%` }} /></div>{message && <p className={`mt-2 text-sm ${phase === "error" ? "text-rose-700" : "text-slate-500"}`}>{message}</p>}<div className="mt-5 flex flex-wrap gap-3"><Button type="button" disabled={uploadMutation.isPending || hasUpload} onClick={() => void upload()} className="rounded-full bg-slate-900 text-white hover:bg-slate-800">{uploadMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : hasUpload ? <><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-300" />Saved securely</> : <><ImagePlus className="mr-2 h-4 w-4 text-cyan-300" />Upload image</>}</Button><Button type="button" variant="outline" className="rounded-full" onClick={resetSelection} disabled={uploadMutation.isPending}><X className="mr-2 h-4 w-4" />Remove</Button></div></div>}</section><section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Upload history</h2><p className="mt-1 text-sm text-slate-500">Your private image archive</p></div><History className="h-5 w-5 text-cyan-700" /></div>{historyQuery.isLoading ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading your history...</div> : historyQuery.data?.length ? <div className="mt-5 space-y-3">{historyQuery.data.map(item => <div key={item.id} className={`flex gap-3 rounded-2xl border border-slate-200 p-3 ${item.status === "removed" ? "opacity-55" : ""}`}><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">{item.status === "removed" ? <Trash2 className="h-5 w-5 text-slate-400" /> : <img src={item.storageUrl} alt="Uploaded X-ray thumbnail" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.originalName}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()} · {formatBytes(item.sizeBytes)}</p><div className="mt-2 flex items-center gap-2"><Badge className={item.status === "removed" ? "bg-slate-100 text-slate-600 hover:bg-slate-100" : item.qualityStatus === "pass" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-amber-50 text-amber-700 hover:bg-amber-50"}>{item.status === "removed" ? "Removed" : item.qualityStatus === "pass" ? "Quality passed" : "Review quality"}</Badge></div></div>{item.status !== "removed" && <Button type="button" variant="ghost" size="icon" className="shrink-0 text-slate-400 hover:text-rose-600" aria-label={`Remove ${item.originalName}`} onClick={() => removeMutation.mutate({ id: item.id })} disabled={removeMutation.isPending}><Trash2 className="h-4 w-4" /></Button>}</div>)}</div> : <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><FileImage className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium">No uploads yet</p><p className="mt-1 text-sm leading-6 text-slate-500">Your uploaded studies will appear here.</p></div>}<div className="mt-6 flex gap-2 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-950"><ShieldCheck className="h-5 w-5 shrink-0 text-cyan-700" /><p>Files are associated with your account. This workflow is for research and education, not medical diagnosis.</p></div></section></div></div></main>;
}

export default function UploadPage() {
  return <><Show when="signed-out"><div className="grid min-h-screen place-items-center bg-[#07101f] px-6 text-white"><div className="text-center"><p className="text-lg">Sign in to upload an X-ray.</p><SignInButton mode="modal"><Button className="mt-5 rounded-full bg-cyan-300 text-[#06101d]">Sign in</Button></SignInButton></div></div></Show><Show when="signed-in"><UploadWorkspace /></Show></>;
}
