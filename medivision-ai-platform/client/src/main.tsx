import { ClerkProvider, useAuth } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { useMemo } from "react";
import superjson from "superjson";
import App from "./App";
import { trpc } from "@/lib/trpc";
import "./index.css";

const queryClient = new QueryClient();
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingClerkConfig() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#07101f] px-6 text-white">
      <section className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">Configuration required</p>
        <h1 className="text-3xl font-semibold tracking-tight">Connect Clerk to continue</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">Set VITE_CLERK_PUBLISHABLE_KEY in the project environment, then restart the development server.</p>
      </section>
    </main>
  );
}

function ClerkTrpcProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const trpcClient = useMemo(() => trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(input, init) {
          return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
        },
      }),
    ],
  }), [getToken]);

  return <trpc.Provider client={trpcClient} queryClient={queryClient}>{children}</trpc.Provider>;
}

function Root() {
  if (!clerkPublishableKey) return <MissingClerkConfig />;
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} signInUrl="/sign-in" signUpUrl="/sign-up">
      <QueryClientProvider client={queryClient}>
        <ClerkTrpcProvider>
          <App />
        </ClerkTrpcProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
