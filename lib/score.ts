import { AgendaRecord, ScoreBand, ScoreResult } from "./types";

/**
 * Metodologia de Score de Validação de Agenda — Pré-campanha.
 * Espelha exatamente a rubrica usada nos relatórios da rotina automática
 * (Google Doc "Relatório de Agenda"), para que o número mostrado aqui
 * nunca divirja do que a coordenação já vê nos relatórios.
 */

const PRIORITY_TYPES = [
  "festa municipal",
  "evento comunitário",
  "associação",
  "entidade",
  "sindicato patronal",
  "cooperativa",
  "feira",
  "evento de bairro",
  "encontro de mulheres",
  "agro",
  "empresário",
  "evento empresarial",
  "liderança local",
  "reunião com lideranças",
];

function norm(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function isYes(value: string | undefined | null): boolean {
  return norm(value).toLowerCase().startsWith("sim");
}

function isBlank(value: string | undefined | null): boolean {
  return norm(value).length === 0;
}

function field(agenda: AgendaRecord, name: string): string {
  return norm(agenda.raw[name]);
}

function scoreAproximacaoMobilizacao(agenda: AgendaRecord): number {
  const publico = field(agenda, "Público estimado").toLowerCase();
  let base = 0;
  if (publico.includes("mais de 500")) base = 40;
  else if (publico.includes("300 a 500")) base = 35;
  else if (publico.includes("100 a 300")) base = 25;
  else if (publico.includes("50 a 100")) base = 15;
  else if (publico.includes("até 50") || publico.includes("ate 50")) base = 5;

  let bonus = 0;
  if (isYes(field(agenda, "Existe possibilidade de captar novos apoiadores?"))) bonus += 3;
  if (isYes(field(agenda, "Existe possibilidade de cadastrar novos contatos?"))) bonus += 3;
  if (isYes(field(agenda, "Existe possibilidade de divulgar o grupo oficial de WhatsApp?"))) bonus += 2;

  return Math.min(40, base + bonus);
}

function scoreRedePolitica(agenda: AgendaRecord): number {
  const lideranças = field(agenda, "Quantas lideranças estarão presentes?").toLowerCase();
  const autoridades = field(agenda, "Autoridades confirmadas").toLowerCase();
  const perfil = field(agenda, "Essa pessoa é:").toLowerCase();
  const tipo = field(agenda, "Tipo de agenda").toLowerCase();

  const texto = `${lideranças} ${autoridades}`;
  let nivel = 0;
  if (/prefeit|deputad|governador|secretári[ao] de estado/.test(texto)) nivel = 25;
  else if (/vereador|secretári[ao]/.test(texto)) nivel = 18;
  else if (/líder|lideranc|coordenador|coronel/.test(texto)) nivel = 10;

  if (nivel === 0) {
    if (/prefeit|deputad|vereador|governador/.test(perfil)) nivel = 20;
    else if (/empresári|líder religios|liderança comunitári|presidente de entidade|coordenador/.test(perfil)) nivel = 10;
    else if (/apoiador/.test(perfil)) nivel = 5;
  }

  const tipoPrioritario = PRIORITY_TYPES.some((t) => tipo.includes(t));
  const bonusTipo = tipoPrioritario ? 5 : 0;

  return Math.min(25, nivel + bonusTipo);
}

function scoreClassificacaoEstrategica(agenda: AgendaRecord): number {
  const classificacao = field(agenda, "Essa agenda é considerada").toLowerCase();
  if (classificacao.includes("muito estratégica")) return 20;
  if (classificacao.includes("estratégica")) return 14;
  if (classificacao.includes("institucional")) return 7;
  if (classificacao.includes("baixa prioridade")) return 2;
  return 0;
}

function scoreCompletude(agenda: AgendaRecord): number {
  let pts = 0;
  const responsavel = field(agenda, "Quem é o responsável por receber a Deputada e equipe?");
  const contato = field(agenda, "Contato do Responsaável") || field(agenda, "Contato do Responsável");
  if (!isBlank(responsavel) && !isBlank(contato)) pts += 5;

  const justificativa = field(agenda, "Explique por que essa agenda é importante.");
  if (justificativa.length > 60) pts += 5;

  if (!isBlank(agenda.dataEvento) && !isBlank(agenda.horarioInicio) && !isBlank(agenda.horarioTermino)) {
    pts += 5;
  }

  return pts;
}

function checkLegalHold(agenda: AgendaRecord): string[] {
  const reasons: string[] = [];

  const obraPublica = field(agenda, "O evento é inauguração de obra pública?").toLowerCase();
  if (obraPublica.startsWith("sim") || obraPublica.includes("não sei") || obraPublica === "n/s") {
    reasons.push('Campo "inauguração de obra pública" = ' + field(agenda, "O evento é inauguração de obra pública?"));
  }

  const duvida = field(agenda, "Existe alguma dúvida jurídica relacionada a essa agenda?").toLowerCase();
  if (
    duvida.length > 0 &&
    !["não", "nao", "nenhuma", "não há", "nao ha", "não.", "n/a"].some((v) => duvida === v)
  ) {
    reasons.push(`Dúvida jurídica registrada: "${field(agenda, "Existe alguma dúvida jurídica relacionada a essa agenda?")}"`);
  }

  const pedidoDiscurso = field(agenda, "Existe pedido para discurso?").toLowerCase();
  const textoRisco = `${field(agenda, "Explique por que essa agenda é importante.")} ${field(agenda, "OBSERVAÇÕES")}`.toLowerCase();
  const linguagemRisco = /\bvote\b|peça o voto|conte comigo nas urnas|vote em mim/.test(textoRisco);
  if (pedidoDiscurso.startsWith("sim") && linguagemRisco) {
    reasons.push("Pedido de discurso confirmado com linguagem de risco de pedido de voto explícito");
  }

  return reasons;
}

function isTestRecord(agenda: AgendaRecord): boolean {
  const email = field(agenda, "Endereço de e-mail").toLowerCase();
  return email.includes("teste.assessoria@exemplo.com") || agenda.assessor.toLowerCase().includes("maria teste");
}

function isIncompleteRecord(agenda: AgendaRecord): boolean {
  const filled = Object.values(agenda.raw).filter((v) => !isBlank(v)).length;
  return filled <= 5 || isBlank(agenda.nomeEvento);
}

function bandFromScore(score: number): ScoreBand {
  if (score >= 80) return "PRIORIDADE_MAXIMA";
  if (score >= 60) return "ESTRATEGICA";
  if (score >= 40) return "INSTITUCIONAL";
  return "REAVALIAR";
}

export function computeScore(agenda: AgendaRecord): ScoreResult {
  const isTest = isTestRecord(agenda);
  const isIncomplete = !isTest && isIncompleteRecord(agenda);

  const sections = {
    aproximacaoMobilizacao: scoreAproximacaoMobilizacao(agenda),
    redePolitica: scoreRedePolitica(agenda),
    classificacaoEstrategica: scoreClassificacaoEstrategica(agenda),
    completude: scoreCompletude(agenda),
  };

  const scoreBase =
    sections.aproximacaoMobilizacao +
    sections.redePolitica +
    sections.classificacaoEstrategica +
    sections.completude;

  const legalHoldReasons = isTest || isIncomplete ? [] : checkLegalHold(agenda);

  return {
    scoreBase,
    sections,
    legalHold: legalHoldReasons.length > 0,
    legalHoldReasons,
    band: bandFromScore(scoreBase),
    isTest,
    isIncomplete,
  };
}

export const BAND_LABELS: Record<ScoreBand, string> = {
  PRIORIDADE_MAXIMA: "🟢 Prioridade Máxima",
  ESTRATEGICA: "🟡 Estratégica",
  INSTITUCIONAL: "🟠 Institucional / Baixa Prioridade",
  REAVALIAR: "🔴 Reavaliar",
};
