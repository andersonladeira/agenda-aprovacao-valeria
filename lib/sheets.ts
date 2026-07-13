import { google, sheets_v4 } from "googleapis";
import { AgendaRecord, ApprovalRecord, ApprovalStatus } from "./types";

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
];

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Veja o README para o passo a passo de configuração.`
    );
  }
  return value;
}

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const email = getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
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
