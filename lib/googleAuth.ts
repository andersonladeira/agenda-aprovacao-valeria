import { google } from "googleapis";

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Veja o README para o passo a passo de configuração.`
    );
  }
  return value;
}

/**
 * Normaliza a chave privada colada em variáveis de ambiente: remove aspas
 * externas que sobram ao copiar de um .env, e converte "\n" literais em
 * quebras de linha reais (o formato PEM exige quebras de linha de verdade).
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").trim();
}

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;

/**
 * Client autenticado como a service account, com escopo para ler/escrever
 * planilhas. Contas de serviço não têm cota própria de armazenamento no
 * Drive (não conseguem criar arquivos novos do zero), então este app só lê
 * e escreve em planilhas que já existem e foram compartilhadas manualmente
 * com a service account como Editor — por isso o único escopo necessário é
 * o de Sheets.
 */
export function getGoogleAuth() {
  if (cachedAuth) return cachedAuth;

  const email = getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalizePrivateKey(getEnv("GOOGLE_PRIVATE_KEY"));

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY não parece um PEM válido (faltando o cabeçalho -----BEGIN PRIVATE KEY-----). " +
        "Confira se o valor colado nas variáveis de ambiente não incluiu aspas extras ou ficou cortado."
    );
  }

  cachedAuth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return cachedAuth;
}
