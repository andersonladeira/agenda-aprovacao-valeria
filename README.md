# Aprovação de Agendas — Pré-campanha Valéria Bolsonaro

Sistema web para aprovar/rejeitar/sinalizar (aguardar jurídico) as agendas enviadas pelo
["Formulário de Solicitação de Agenda"](https://docs.google.com/spreadsheets/d/1JjGZRw0BksBwphssw7jh7h3jggIPbHyvih9th4NLOOI),
com a mesma metodologia de Score de Validação usada nos relatórios automáticos.

- A planilha continua sendo a única fonte de verdade das agendas.
- As decisões de aprovação são gravadas em uma aba nova, **"Aprovações"**, criada automaticamente
  na mesma planilha — nada é sobrescrito na aba de respostas do formulário.
- Acesso protegido por senha compartilhada (`APP_PASSWORD`).

## 1. Criar a credencial do Google (Service Account)

O app precisa de uma "Service Account" do Google Cloud para ler e escrever na planilha em nome do
sistema (sem depender do login de uma pessoa).

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie um projeto (ou use um existente).
2. Em **APIs e serviços > Biblioteca**, ative a **Google Sheets API**.
3. Em **APIs e serviços > Credenciais > Criar credenciais > Conta de serviço**, crie uma service account
   (ex: `agenda-aprovacao`). Não precisa dar nenhum papel/role especial no projeto.
4. Abra a service account criada, vá em **Chaves > Adicionar chave > Criar nova chave > JSON** e baixe o arquivo.
5. Do JSON baixado, você vai usar dois campos:
   - `client_email` → variável `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → variável `GOOGLE_PRIVATE_KEY` (mantenha as quebras de linha `\n` como estão no JSON)
6. **Compartilhe a planilha** "Formulário de Solicitação de Agenda (respostas)" com o e-mail da service
   account (o `client_email`, algo como `agenda-aprovacao@SEU-PROJETO.iam.gserviceaccount.com`),
   dando permissão de **Editor** — sem isso o app não consegue gravar as aprovações.

## 2. Configurar variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```bash
cp .env.local.example .env.local
```

| Variável | Descrição |
| --- | --- |
| `GOOGLE_SHEET_ID` | ID da planilha (já preenchido com o valor da campanha) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` do JSON da service account |
| `GOOGLE_PRIVATE_KEY` | `private_key` do JSON da service account (entre aspas, com `\n`) |
| `RESPOSTAS_SHEET_NAME` | Nome da aba de respostas do formulário (padrão: `Respostas ao formulário 1`) |
| `APROVACOES_SHEET_NAME` | Nome da aba onde as decisões são gravadas (padrão: `Aprovações`, criada automaticamente) |
| `APP_PASSWORD` | Senha compartilhada para acessar o sistema |
| `SESSION_SECRET` | Qualquer string aleatória longa, usada para assinar o cookie de sessão |

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Ele vai pedir nome + senha (a `APP_PASSWORD`
configurada), depois mostra a lista de agendas com o score calculado e os botões de decisão.

## 4. Deploy no Vercel

1. Suba este projeto para um repositório Git (GitHub/GitLab/Bitbucket).
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
3. Em **Environment Variables**, adicione as mesmas variáveis do `.env.local` (item 2 acima).
   - Atenção ao colar `GOOGLE_PRIVATE_KEY`: cole o valor com `\n` literal (como está no JSON) — o
     código já converte `\n` para quebra de linha real em tempo de execução.
4. Clique em **Deploy**. Em poucos minutos você tem uma URL pública (ex: `agenda-aprovacao.vercel.app`).
5. Compartilhe a URL e a `APP_PASSWORD` com a coordenação/jurídico da campanha.

## Como funciona o Score

A pontuação (0–100) e a trava jurídica em `lib/score.ts` seguem exatamente a mesma metodologia usada
nos relatórios automáticos da rotina (Google Doc "Relatório de Agenda"):

- **Aproximação e Mobilização de Público** (até 40 pts) — tamanho do público, captação de apoiadores,
  novos contatos, divulgação do grupo de WhatsApp.
- **Fortalecimento de Rede Política** (até 25 pts) — nível das autoridades/lideranças presentes, perfil
  de quem convidou, tipo de agenda dentro da lista prioritária da coordenação.
- **Classificação Estratégica Declarada** (até 20 pts) — autoclassificação do assessor.
- **Completude do Preenchimento** (até 15 pts) — campos de logística, justificativa e data/horário.
- **Trava jurídica** — sobrepõe a nota sempre que: o evento é inauguração de obra pública, há dúvida
  jurídica registrada (diferente de "não"/"nenhuma"), ou há pedido de discurso combinado com linguagem
  de risco de pedido de voto explícito.

Registros que reproduzem o exemplo do tutorial do formulário, ou que têm poucos campos preenchidos, são
marcados como **dado de teste** / **registro incompleto** e não entram na pontuação.

## Estrutura

```
app/
  page.tsx              → dashboard (client component)
  login/page.tsx         → tela de login (senha + nome do aprovador)
  api/agendas/route.ts    → GET: lê a planilha, calcula score, junta com aprovações
  api/approve/route.ts    → POST: grava a decisão na aba "Aprovações"
  api/login/route.ts      → POST: valida a senha e cria o cookie de sessão
  api/logout/route.ts     → POST: remove o cookie de sessão
components/
  Dashboard.tsx           → lista, filtros e contadores
  AgendaCard.tsx          → card de cada agenda com os botões de decisão
lib/
  sheets.ts               → cliente do Google Sheets (leitura das agendas e das aprovações)
  score.ts                → metodologia de score e trava jurídica
  auth.ts                 → sessão simples por senha compartilhada
proxy.ts                  → protege todas as rotas exceto /login (Next.js 16 renomeou "middleware" para "proxy")
```
