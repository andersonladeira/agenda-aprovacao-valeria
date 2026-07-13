import { google, sheets_v4 } from "googleapis";
import { AgendaRecord, ApprovalRecord, ApprovalStatus } from "./types";
import { getEnv, getGoogleAuth } from "./googleAuth";

const RESPOSTAS_SHEET_NAME = process.env.RESPOSTAS_SHEET_NAME || "Respostas ao formulário 1";
const APROVACOES_SHEET_NAME = process.env.APROVACOES_SHEET_NAME || "Aprovações";

const APROVACOES_HEADERS = [
  "Carimbo",
  "Nome do evento",
  "Assessor",
  "Status",
  "Aprovador",
  "Data da decisão",
  "Comentário",
  "Score base",
  "Faixa",
  "Ok Ronaldo",
  "Ok Valéria",
];

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  cachedClient = google.sheets({ version: "v4", auth: getGoogleAuth() });
  return cachedClient;
}

function getSheetId(): string {
  return getEnv("GOOGLE_SHEET_ID");
}

function rowsToRecords(rows: string[][]): { headers: string[]; records: Record<string, string>[] } {
  const [headerRow, ...dataRows] = rows;
  const headers = (headerRow ?? []).map((h) => h.trim());
  const records = dataRows
    .filter((row) => row.some((cell) => (cell ?? "").trim().length > 0))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, i) => {
        record[header] = (row[i] ?? "").trim();
      });
      return record;
    });
  return { headers, records };
}

export async function getAgendas(): Promise<AgendaRecord[]> {
  const client = getClient();
  const spreadsheetId = getSheetId();

  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${RESPOSTAS_SHEET_NAME}'`,
  });

  const rows = (res.data.values as string[][]) ?? [];
  const { records } = rowsToRecords(rows);

  return records
    .filter((raw) => (raw["Carimbo de data/hora"] ?? "").trim().length > 0)
    .map((raw) => ({
      raw,
      carimbo: raw["Carimbo de data/hora"] ?? "",
      assessor: raw["Assessor"] ?? "",
      cidade: raw["Cidade"] ?? "",
      nomeEvento: raw["Nome do evento / encontro"] ?? "",
      dataEvento: raw["Data"] ?? "",
      horarioInicio: raw["Horário de início"] ?? "",
      horarioTermino: raw["Horário previsto de término"] ?? "",
    }));
}

async function ensureApprovalsSheet(client: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const meta = await client.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === APROVACOES_SHEET_NAME
  );

  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: APROVACOES_SHEET_NAME } } }],
      },
    });
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${APROVACOES_SHEET_NAME}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [APROVACOES_HEADERS] },
    });
    return;
  }

  // A aba já existia (de antes de alguma coluna ser adicionada, ex.: "Ok
  // Ronaldo"/"Ok Valéria") — garante que o cabeçalho tenha todas as colunas
  // atuais, sem mexer nas linhas de dados já gravadas.
  const headerRes = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${APROVACOES_SHEET_NAME}'!1:1`,
  });
  const currentHeader = (headerRes.data.values?.[0] as string[]) ?? [];
  const isUpToDate = APROVACOES_HEADERS.every((h, i) => currentHeader[i] === h);
  if (!isUpToDate) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${APROVACOES_SHEET_NAME}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [APROVACOES_HEADERS] },
    });
  }
}

export async function getApprovals(): Promise<Map<string, ApprovalRecord>> {
  const client = getClient();
  const spreadsheetId = getSheetId();
  await ensureApprovalsSheet(client, spreadsheetId);

  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${APROVACOES_SHEET_NAME}'`,
  });

  const rows = (res.data.values as string[][]) ?? [];
  const { records } = rowsToRecords(rows);

  const map = new Map<string, ApprovalRecord>();
  for (const r of records) {
    const carimbo = r["Carimbo"];
    if (!carimbo) continue;
    map.set(carimbo, {
      carimbo,
      nomeEvento: r["Nome do evento"] ?? "",
      assessor: r["Assessor"] ?? "",
      status: (r["Status"] as ApprovalStatus) || "PENDENTE",
      aprovador: r["Aprovador"] ?? "",
      dataDecisao: r["Data da decisão"] ?? "",
      comentario: r["Comentário"] ?? "",
      scoreBase: Number(r["Score base"] ?? 0),
      faixa: (r["Faixa"] as ApprovalRecord["faixa"]) || "REAVALIAR",
      okRonaldo: r["Ok Ronaldo"] === "Sim",
      okValeria: r["Ok Valéria"] === "Sim",
    });
  }
  return map;
}

export async function upsertApproval(record: ApprovalRecord): Promise<void> {
  const client = getClient();
  const spreadsheetId = getSheetId();
  await ensureApprovalsSheet(client, spreadsheetId);

  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${APROVACOES_SHEET_NAME}'`,
  });
  const rows = (res.data.values as string[][]) ?? [APROVACOES_HEADERS];

  const rowValues = [
    record.carimbo,
    record.nomeEvento,
    record.assessor,
    record.status,
    record.aprovador,
    record.dataDecisao,
    record.comentario,
    String(record.scoreBase),
    record.faixa,
    record.okRonaldo ? "Sim" : "",
    record.okValeria ? "Sim" : "",
  ];

  const existingIndex = rows.findIndex((row, i) => i > 0 && row[0] === record.carimbo);

  if (existingIndex > 0) {
    const rowNumber = existingIndex + 1; // 1-indexed for the Sheets API
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${APROVACOES_SHEET_NAME}'!A${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `'${APROVACOES_SHEET_NAME}'!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowValues] },
    });
  }
}

const CHECKLIST_COLUMNS = { okRonaldo: "J", okValeria: "K" } as const;

/**
 * Marca/desmarca um dos checkboxes de conferência (Ok Ronaldo / Ok Valéria)
 * sem mexer no resto da linha. Se a agenda ainda não tiver nenhuma decisão
 * registrada, cria uma linha nova com status Pendente.
 */
export async function updateChecklistField(
  agendaMeta: { carimbo: string; nomeEvento: string; assessor: string; scoreBase: number; faixa: ApprovalRecord["faixa"] },
  field: "okRonaldo" | "okValeria",
  value: boolean
): Promise<void> {
  const client = getClient();
  const spreadsheetId = getSheetId();
  await ensureApprovalsSheet(client, spreadsheetId);

  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${APROVACOES_SHEET_NAME}'`,
  });
  const rows = (res.data.values as string[][]) ?? [APROVACOES_HEADERS];
  const existingIndex = rows.findIndex((row, i) => i > 0 && row[0] === agendaMeta.carimbo);

  if (existingIndex > 0) {
    const rowNumber = existingIndex + 1;
    const column = CHECKLIST_COLUMNS[field];
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${APROVACOES_SHEET_NAME}'!${column}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [[value ? "Sim" : ""]] },
    });
  } else {
    await upsertApproval({
      carimbo: agendaMeta.carimbo,
      nomeEvento: agendaMeta.nomeEvento,
      assessor: agendaMeta.assessor,
      status: "PENDENTE",
      aprovador: "",
      dataDecisao: "",
      comentario: "",
      scoreBase: agendaMeta.scoreBase,
      faixa: agendaMeta.faixa,
      okRonaldo: field === "okRonaldo" ? value : false,
      okValeria: field === "okValeria" ? value : false,
    });
  }
}
