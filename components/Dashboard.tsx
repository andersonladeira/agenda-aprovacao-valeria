"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AgendaWithApproval, ApprovalStatus } from "@/lib/types";
import { AgendaCard } from "./AgendaCard";
import { CalendarView } from "./CalendarView";
import { Modal } from "./Modal";
import { statusOf } from "@/lib/ui";

type Filter = "TODAS" | "PENDENTES" | ApprovalStatus;
type View = "lista" | "calendario";

export function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<AgendaWithApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("PENDENTES");
  const [view, setView] = useState<View>("lista");
  const [approverName, setApproverName] = useState("");
  const [selectedCarimbo, setSelectedCarimbo] = useState<string | null>(null);
  const [officialAgendaUrl, setOfficialAgendaUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agendas", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar agendas.");
      setItems(data.items);
      if (data.officialAgendaUrl) setOfficialAgendaUrl(data.officialAgendaUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Busca de dados on-mount: padrão recomendado pelos docs do React para
    // sincronizar estado com um sistema externo (a planilha via /api/agendas).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const match = document.cookie.match(/agenda_approver=([^;]+)/);
    if (match) setApproverName(decodeURIComponent(match[1]));
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      TODAS: items.length,
      PENDENTES: 0,
      PENDENTE: 0,
      APROVADA: 0,
      REJEITADA: 0,
      AGUARDAR_JURIDICO: 0,
    };
    for (const item of items) {
      const s = statusOf(item);
      c[s] += 1;
      if (s === "PENDENTE") c.PENDENTES += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "TODAS") return items;
    if (filter === "PENDENTES") return items.filter((i) => statusOf(i) === "PENDENTE");
    return items.filter((i) => statusOf(i) === filter);
  }, [items, filter]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "PENDENTES", label: `Pendentes (${counts.PENDENTES})` },
    { key: "AGUARDAR_JURIDICO", label: `Aguardar Jurídico (${counts.AGUARDAR_JURIDICO})` },
    { key: "APROVADA", label: `Aprovadas (${counts.APROVADA})` },
    { key: "REJEITADA", label: `Rejeitadas (${counts.REJEITADA})` },
    { key: "TODAS", label: `Todas (${counts.TODAS})` },
  ];

  const selectedItem = items.find((i) => i.agenda.carimbo === selectedCarimbo) ?? null;
  const containerWidth = view === "calendario" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className={`${containerWidth} mx-auto px-4 py-4 flex items-center justify-between transition-[max-width]`}>
          <div>
            <h1 className="font-semibold text-slate-900">Aprovação de Agendas</h1>
            <p className="text-xs text-slate-500">Pré-campanha Valéria Bolsonaro</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {officialAgendaUrl && (
              <a
                href={officialAgendaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 underline decoration-slate-300"
              >
                Agenda Oficial (Aprovadas)
              </a>
            )}
            <span className="text-slate-500">{approverName}</span>
            <button onClick={load} className="text-slate-600 hover:text-slate-900">
              Atualizar
            </button>
            <button onClick={logout} className="text-slate-600 hover:text-slate-900">
              Sair
            </button>
          </div>
        </div>
        <div className={`${containerWidth} mx-auto px-4 pb-3 flex items-center justify-between gap-2 transition-[max-width]`}>
          <div className="flex gap-2 overflow-x-auto">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border ${
                  filter === f.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="shrink-0 flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setView("lista")}
              className={`px-3 py-1.5 ${view === "lista" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Lista
            </button>
            <button
              onClick={() => setView("calendario")}
              className={`px-3 py-1.5 border-l border-slate-200 ${view === "calendario" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Calendário
            </button>
          </div>
        </div>
      </header>

      <main className={`${containerWidth} mx-auto px-4 py-6 space-y-4 transition-[max-width]`}>
        {loading && <p className="text-sm text-slate-500">Carregando agendas...</p>}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma agenda nesse filtro.</p>
        )}

        {!loading && !error && filtered.length > 0 && view === "lista" && (
          <div className="space-y-4">
            {filtered.map((item) => (
              <AgendaCard key={item.agenda.carimbo} item={item} onDecided={load} />
            ))}
          </div>
        )}

        {!loading && !error && view === "calendario" && (
          <CalendarView items={filtered} onSelect={(item) => setSelectedCarimbo(item.agenda.carimbo)} />
        )}
      </main>

      {selectedItem && (
        <Modal onClose={() => setSelectedCarimbo(null)}>
          <AgendaCard item={selectedItem} onDecided={load} />
        </Modal>
      )}
    </div>
  );
}
