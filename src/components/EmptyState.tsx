import React from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Sparkles,
  TrendingUp,
  Layers,
  Activity,
  ShieldCheck,
  CheckCircle2,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface EmptyStateProps {
  onOpenUpload: () => void;
  onDownloadExcelTemplate?: () => void;
  onDownloadCSVTemplate?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onOpenUpload,
  onDownloadExcelTemplate,
  onDownloadCSVTemplate,
}) => {
  const supportedColumns = [
    { name: 'Papel / Ticker', req: true, desc: 'Ex: PETR4, VALE3, ITUB4' },
    { name: 'Cotação (R$)', req: true, desc: 'Preço atual da ação' },
    { name: 'P/L', req: false, desc: 'Preço sobre Lucro' },
    { name: 'P/VP', req: false, desc: 'Preço sobre Valor Patrimonial' },
    { name: 'Div. Yield (%)', req: false, desc: 'Dividendos pagos nos últimos 12 meses' },
    { name: 'ROIC (%)', req: false, desc: 'Retorno sobre o Capital Investido' },
    { name: 'ROE (%)', req: false, desc: 'Retorno sobre Patrimônio Líquido' },
    { name: 'Liq. 2 Meses (R$)', req: false, desc: 'Volume médio diário de negociação' },
    { name: 'Patrimônio Líq.', req: false, desc: 'Patrimônio líquido contábil' },
    { name: 'Setor & Nome', req: false, desc: 'Classificação setorial B3' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 sm:py-8 animate-in fade-in duration-300">
      {/* Hero Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Terminal B3 Pro · Base Pronta para Ingestão</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Carregue sua Planilha para Iniciar a Análise
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            A base de ativos está limpa. O aplicativo está pronto para receber exclusivamente os dados do seu arquivo <strong className="text-emerald-400">CSV</strong> ou planilha <strong className="text-emerald-400">Excel (.xlsx)</strong>.
          </p>

          {/* Primary CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Carregar Arquivo CSV ou Excel</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onDownloadExcelTemplate && (
                <button
                  onClick={onDownloadExcelTemplate}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                  title="Baixar planilha de exemplo pronta para preenchimento"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Modelo .xlsx</span>
                </button>
              )}

              {onDownloadCSVTemplate && (
                <button
                  onClick={onDownloadCSVTemplate}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                  title="Baixar arquivo CSV delimitado por ponto-e-vírgula"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span>Modelo .csv</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-4 text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Zero Duplicações
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Detecção Automática de Delimitador
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Compatível com Status Invest / Fundamentus
            </span>
          </div>
        </div>
      </div>

      {/* Feature Capabilities Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          O que será gerado automaticamente após o upload:
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Rankings Quantitativos</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cálculo simultâneo de Graham (Preço Justo), Bazin (Preço Teto), Greenblatt (Fórmula Mágica) e Score Alpha ponderado.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Análise DuPont & Múltiplos</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Comparações de P/L vs ROE, dispersão setorial, margens (EBIT, Líquida, Bruta) e alavancagem de endividamento.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Fluxo dos Tubarões</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mapeamento de pegadas institucionais com metodologia Wyckoff de acumulação silenciosa e transações de insiders.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Inteligência Artificial & Trades</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gatilhos de entrada, stop loss, alvos técnicos e varredura de fatos relevantes com Google Search Grounding.
            </p>
          </div>
        </div>
      </div>

      {/* Supported Columns Guide */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Colunas Reconhecidas pelo Motor de Ingestão</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Formatos aceitos: .csv, .xlsx, .xls</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Você não precisa se preocupar com a ordem exata ou maiúsculas/minúsculas. O sistema normaliza automaticamente os nomes de colunas:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {supportedColumns.map((col, idx) => (
            <div key={idx} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{col.name}</span>
                {col.req && (
                  <span className="text-[10px] font-mono text-emerald-400">obrigatório</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{col.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
