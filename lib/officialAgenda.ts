import { google, sheets_v4 } from "googleapis";
import { getGoogleAuth } from "./googleAuth";
import { AgendaRecord, ApprovalRecord, ApprovalStatus } from "./types";

/** Abas com histórico próprio, uma por decisão que gera acompanhamento. */
const TABS: Partial<Record<ApprovalStatus, string>> = {
  APROVADA: "Aprovadas",
  REJEITADA: "Recusados",
};
const ALL_TAB_NAMES = Object.values(TABS);

const HEADERS = [
  "Carimbo",
  "Status",
  "Nome do evento",
  "Data",
  "Horário de início",
  "Horário previsto de término",
  "Cidade",
  "Local",
  "Endereço completo",
  "Quem vai receber",
  "Contato de quem recebe",
  "Público estimado",
  "Lideranças presentes",
  "Autoridades confirmadas",
  "A deputada falará?",
  "Tempo previsto de fala",
  "Quem convidou",
  "Assessora",
  "Decidido por",
  "Data da decisão",
  "Comentário da decisão",
  "Score",
];

let cachedSheets: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedSheets) return cachedSheets;
  cachedSheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
  return cachedSheets;
}

/**
 * ID de uma planilha Google já criada e compartilhada manualmente (como
 * Editor) com a service account. Contas de serviço fora de um Workspace não
 * têm cota de armazenamento própria e não conseguem criar arquivos novos do
 * zero — por isso essa planilha precisa existir e ser compartilhada
 * previamente (veja o README), em vez de ser criada automaticamente.
 */
function getSpreadsheetId(): string | null {
  const id = process.env.OFFICIAL_AGENDA_SHEET_ID;
  return id && id.trim().length > 0 ? id.trim() : null;
}

export type OfficialAgendaInfo = { spreadsheetId: string; webViewLink: string };

export function getOfficialAgendaInfo(): OfficialAgendaInfo | null {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;
  return { spreadsheetId, webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}

async function ensureTab(sheets: sheets_v4.Sheets, spreadsheetId: string, tabName: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tabName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
}

function buildRow(agenda: AgendaRecord, approval: ApprovalRecord): string[] {
  const raw = agenda.raw;
  return [
    agenda.carimbo,
    approval.status,
    agenda.nomeEvento,
    agenda.dataEvento,
    agenda.horarioInicio,
    agenda.horarioTermino,
    agenda.cidade,
    raw["Local"] ?? "",
    raw["Endereço completo"] ?? "",
    raw["Quem é o responsável por receber a Deputada e equipe?"] ?? "",
    raw["Contato do Responsaável"] || raw["Contato do Responsável"] || "",
    raw["Público estimado"] ?? "",
    raw["Quantas lideranças estarão presentes?"] ?? "",
    raw["Autoridades confirmadas"] ?? "",
    raw["A deputada falará?"] ?? "",
    raw["Tempo previsto de fala"] ?? "",
    [raw["Nome"], raw["Cargo"]].filter(Boolean).join(" — "),
    agenda.assessor,
    approval.aprovador,
    approval.dataDecisao,
    approval.comentario,
    String(approval.scoreBase),
  ];
}

async function upsertRowInTab(
  spreadsheetId: string,
  tabName: string,
  agenda: AgendaRecord,
  approval: ApprovalRecord
): Promise<void> {
  const sheets = getSheetsClient();
  await ensureTab(sheets, spreadsheetId, tabName);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tabName}'` });
  const rows = (res.data.values as string[][]) ?? [HEADERS];
  const rowValues = buildRow(agenda, approval);
  const existingIndex = rows.findIndex((row, i) => i > 0 && row[0] === agenda.carimbo);

  if (existingIndex > 0) {
    const rowNumber = existingIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowValues] },
    });
  }
}

/**
 * Quando uma agenda que já tinha linha numa dessas abas muda de decisão,
 * marcamos a linha existente como revogada em vez de apagar — mantém o
 * histórico visível. Não faz nada se a aba/linha não existir.
 */
async function markRevokedInTab(
  spreadsheetId: string,
  tabName: string,
  carimbo: string,
  novoStatus: string
): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tabName}'` });
  const rows = (res.data.values as string[][]) ?? [];
  const existingIndex = rows.findIndex((row, i) => i > 0 && row[0] === carimbo);
  if (existingIndex <= 0) return;

  // Já está marcada como revogada com o mesmo status atual — evita escrita desnecessária.
  if (rows[existingIndex][1]?.includes(`decisão atual: ${novoStatus}`)) return;

  const rowNumber = existingIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!B${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [[`REVOGADA (decisão atual: ${novoStatus})`]] },
  });
}

/**
 * Sincroniza a planilha oficial com a decisão atual de uma agenda: grava a
 * linha na aba correspondente ao status atual (Aprovadas ou Recusados) e
 * marca como revogada qualquer linha remanescente nas outras abas — por
 * exemplo, se uma agenda que estava em Recusados passa a ser Aprovada. Não
 * faz nada se a planilha oficial não estiver configurada (OFFICIAL_AGENDA_SHEET_ID).
 */
export async function syncOfficialAgenda(agenda: AgendaRecord | null, approval: ApprovalRecord): Promise<void> {
  const info = getOfficialAgendaInfo();
  if (!info) return;

  const targetTab = TABS[approval.status];

  for (const tabName of ALL_TAB_NAMES) {
    if (tabName === targetTab && agenda) {
      await upsertRowInTab(info.spreadsheetId, tabName!, agenda, approval);
    } else {
      await markRevokedInTab(info.spreadsheetId, tabName!, approval.carimbo, approval.status);
    }
  }
}
