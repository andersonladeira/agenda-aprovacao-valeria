"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgendaWithApproval } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS, statusOf, parseAgendaDate } from "@/lib/ui";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

export function CalendarView({
  items,
  onSelect,
}: {
  items: AgendaWithApproval[];
  onSelect: (item: AgendaWithApproval) => void;
}) {
  const today = new Date();
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const hasAutoSelected = useRef(false);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaWithApproval[]>();
    for (const item of items) {
      const parsed = parseAgendaDate(item.agenda.dataEvento);
      if (!parsed) continue;
      const key = dateKey(parsed.year, parsed.month, parsed.day);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const semData = useMemo(
    () => items.filter((item) => !parseAgendaDate(item.agenda.dataEvento)),
    [items]
  );

  useEffect(() => {
    if (hasAutoSelected.current || items.length === 0) return;
    const dated = items
      .map((item) => ({ item, parsed: parseAgendaDate(item.agenda.dataEvento) }))
      .filter((x): x is { item: AgendaWithApproval; parsed: NonNullable<ReturnType<typeof parseAgendaDate>> } => x.parsed !== null)
      .sort((a, b) => new Date(a.parsed.year, a.parsed.month, a.parsed.day).getTime() - new Date(b.parsed.year, b.parsed.month, b.parsed.day).getTime());
    if (dated.length > 0) {
      const first = dated[0].parsed;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ajusta o mês inicial pra onde as agendas realmente estão, uma única vez ao carregar
      setMonthDate(new Date(first.year, first.month, 1));
    }
    hasAutoSelected.current = true;
  }, [items]);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const result: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const date = new Date(year, month, i - startOffset + 1);
      result.push({ date, inMonth: date.getMonth() === month });
    }
    return result;
  }, [year, month]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setMonthDate(new Date(year, month - 1, 1))}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
          >
            Hoje
          </button>
          <button
            onClick={() => setMonthDate(new Date(year, month + 1, 1))}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
          >
            Próximo →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-slate-50 text-slate-500 font-medium text-center py-1.5">
            {w}
          </div>
        ))}
        {cells.map(({ date, inMonth }, i) => {
          const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
          const dayItems = itemsByDay.get(key) ?? [];
          const isToday = date.toDateString() === today.toDateString();
          return (
            <div
              key={i}
              className={`bg-white min-h-[6.5rem] p-1.5 flex flex-col gap-1 ${inMonth ? "" : "bg-slate-50/60"}`}
            >
              <span
                className={`text-[11px] ${isToday ? "font-bold text-slate-900" : inMonth ? "text-slate-500" : "text-slate-300"}`}
              >
                {date.getDate()}
              </span>
              {dayItems.map((item) => {
                const status = statusOf(item);
                return (
                  <button
                    key={item.agenda.carimbo}
                    onClick={() => onSelect(item)}
                    title={`${item.agenda.nomeEvento} — ${STATUS_LABELS[status]}`}
                    className={`text-left rounded px-1.5 py-0.5 text-[11px] leading-tight border truncate ${STATUS_COLORS[status]} hover:opacity-80`}
                  >
                    {item.agenda.nomeEvento || "(sem nome)"}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {semData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium text-slate-800 mb-2">
            Agendas sem data definida ({semData.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {semData.map((item) => {
              const status = statusOf(item);
              return (
                <button
                  key={item.agenda.carimbo}
                  onClick={() => onSelect(item)}
                  className={`rounded-full px-2.5 py-1 text-xs border ${STATUS_COLORS[status]} hover:opacity-80`}
                >
                  {item.agenda.nomeEvento || "(sem nome)"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
