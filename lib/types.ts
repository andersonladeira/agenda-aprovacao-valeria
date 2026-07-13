export type AgendaRecord = {
  /** Linha bruta da planilha, indexada pelo cabeçalho */
  raw: Record<string, string>;
  /** Carimbo de data/hora original (chave única da agenda) */
  carimbo: string;
  assessor: string;
  cidade: string;
  nomeEvento: string;
  dataEvento: string;
  horarioInicio: string;
  horarioTermino: string;
};

export type ScoreBand =
  | "PRIORIDADE_MAXIMA"
  | "ESTRATEGICA"
  | "INSTITUCIONAL"
  | "REAVALIAR";

export type ScoreResult = {
  scoreBase: number;
  sections: {
    aproximacaoMobilizacao: number;
    redePolitica: number;
    classificacaoEstrategica: number;
    completude: number;
  };
  legalHold: boolean;
  legalHoldReasons: string[];
  band: ScoreBand;
  isTest: boolean;
  isIncomplete: boolean;
};

export type ApprovalStatus = "PENDENTE" | "APROVADA" | "REJEITADA";

export type ApprovalRecord = {
  carimbo: string;
  nomeEvento: string;
  assessor: string;
  status: ApprovalStatus;
  aprovador: string;
  dataDecisao: string;
  comentario: string;
  scoreBase: number;
  faixa: ScoreBand;
  okRonaldo: boolean;
  okValeria: boolean;
};

export type AgendaWithApproval = {
  agenda: AgendaRecord;
  score: ScoreResult;
  approval: ApprovalRecord | null;
};
