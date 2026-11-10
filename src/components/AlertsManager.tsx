import React, { useState } from 'react';
import { StockIndicator, CustomAlert } from '../types/stock';
import { formatCurrency } from '../utils/financialCalculations';
import { Bell, Plus, Trash2, CheckCircle, AlertTriangle, Volume2, ShieldAlert, Sparkles, Send } from 'lucide-react';

interface AlertsManagerProps {
  stocks: StockIndicator[];
  alerts: CustomAlert[];
  onAddAlert: (alert: CustomAlert) => void;
  onToggleAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onTriggerTestAlert: (stock: StockIndicator, title: string, body: string) => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  stocks,
  alerts,
  onAddAlert,
  onToggleAlert,
  onDeleteAlert,
  onTriggerTestAlert,
}) => {
  const [selectedStockId, setSelectedStockId] = useState<string>(stocks[0]?.id || '');
  const [alertType, setAlertType] = useState<CustomAlert['tipo']>('ponto_entrada');
  const [thresholdValue, setThresholdValue] = useState<string>('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const requestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const stock = stocks.find((s) => s.id === selectedStockId) || stocks[0];
    if (!stock) return;

    let defaultMsg = '';
    const numVal = parseFloat(thresholdValue) || 0;

    switch (alertType) {
      case 'ponto_entrada':
        defaultMsg = `${stock.papel} atingiu o Ponto de Entrada técnico ideal em R$ ${stock.pontoEntrada.toFixed(2)}`;
        break;
      case 'variacao_dia':
        defaultMsg = `${stock.papel} oscilou mais de ${numVal}% no pregão de hoje!`;
        break;
      case 'pl_abaixo':
        defaultMsg = `${stock.papel} está com P/L abaixo de ${numVal} (Oportunidade de barganha)`;
        break;
      case 'dy_acima':
        defaultMsg = `${stock.papel} superou Dividend Yield de ${numVal}%`;
        break;
      case 'acumulacao_tubaroes':
        defaultMsg = `Detectada forte Acumulação Silenciosa por grandes investidores em ${stock.papel}`;
        break;
      default:
        defaultMsg = `Alerta disparado para o ativo ${stock.papel}`;
    }

    const newAlert: CustomAlert = {
      id: 'alert_' + Date.now(),
      stockTicker: stock.papel,
      tipo: alertType,
      valorGatilho: numVal || stock.pontoEntrada,
      ativo: true,
      mensagem: defaultMsg,
      criadoEm: new Date().toLocaleDateString('pt-BR'),
    };

    onAddAlert(newAlert);
    setThresholdValue('');
  };

  const simulateLiveTrigger = (stock: StockIndicator) => {
    onTriggerTestAlert(
      stock,
      `🚨 ALERTA B3: ${stock.papel} - Ponto de Entrada Atingido!`,
      `O ativo ${stock.papel} recuou para R$ ${stock.pontoEntrada.toFixed(2)} com forte suporte institucional e volume de compra.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Title & Section Header */}
      <div className="pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
          <span>Monitoramento em Tempo Real</span>
          <span aria-hidden="true">·</span>
          <span>Push Notifications API</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Alertas Personalizados & Notificações Push
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Configure regras automáticas para receber alertas no navegador no exato momento em que um ativo atingir o ponto de entrada, oscilar bruscamente ou apresentar acumulação por grandes players.
        </p>
      </div>

      {/* Permission Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              Notificações Push do Navegador
            </div>
            <div className="text-xs text-slate-400">
              Status da Permissão:{' '}
              <strong className={notificationPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'}>
                {notificationPermission === 'granted' ? 'Habilitado (Recebendo alertas)' : 'Pendente de Ativação'}
              </strong>
            </div>
          </div>
        </div>

        {notificationPermission !== 'granted' ? (
          <button
            onClick={requestBrowserPermission}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap"
          >
            Ativar Notificações Push
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span>Sistema Pronto para Envio</span>
          </div>
        )}
      </div>

      {/* Grid: Create Alert on Left, Active Alerts & Simulator on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Create Form */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Configurar Nova Regra de Alerta</span>
          </h3>

          <form onSubmit={handleCreateAlert} className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Ativo da Carteira / Imagem:</label>
              <select
                value={selectedStockId}
                onChange={(e) => setSelectedStockId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {stocks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.papel} - {s.nomeEmpresa} (Cotação: {formatCurrency(s.cotacao)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Tipo de Gatilho:</label>
              <select
                value={alertType}
                onChange={(e: any) => setAlertType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ponto_entrada">Ponto de Entrada Técnico Atingido</option>
                <option value="variacao_dia">Variação Diária Expressiva (± %)</option>
                <option value="pl_abaixo">P/L cair abaixo de um patamar</option>
                <option value="dy_acima">Dividend Yield superar meta (%)</option>
                <option value="acumulacao_tubaroes">Detecção de Acumulação por Tubarões</option>
              </select>
            </div>

            {alertType !== 'ponto_entrada' && alertType !== 'acumulacao_tubaroes' && (
              <div>
                <label className="text-slate-400 block mb-1">Valor do Gatilho Numérico:</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 5.0 (para 5% ou múltiplo)"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg transition-colors"
            >
              Salvar Alerta Ativo
            </button>
          </form>

          {/* Quick Simulator Test */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Simulador de Oscilação em Tempo Real:
            </span>
            <p className="text-[11px] text-slate-500">
              Clique para disparar instantaneamente uma notificação push de teste no navegador para o ativo selecionado.
            </p>
            <button
              onClick={() => {
                const stock = stocks.find((s) => s.id === selectedStockId) || stocks[0];
                if (stock) simulateLiveTrigger(stock);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Disparar Push de Teste Agora</span>
            </button>
          </div>
        </div>

        {/* Right Column: Active Alerts List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Alertas Cadastrados ({alerts.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {alerts.filter((a) => a.ativo).length} ativos
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Nenhum alerta cadastrado ainda. Use o formulário ao lado para criar o primeiro alerta.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onToggleAlert(alert.id)}
                        className={`w-7 h-4 rounded-full transition-colors relative ${
                          alert.ativo ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`block w-3 h-3 bg-white rounded-full transition-transform absolute top-0.5 ${
                            alert.ativo ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">
                            {alert.stockTicker}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {alert.criadoEm}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] mt-0.5">
                          {alert.mensagem}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const stock = stocks.find((s) => s.papel === alert.stockTicker) || stocks[0];
                          if (stock) simulateLiveTrigger(stock);
                        }}
                        title="Simular disparo agora"
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteAlert(alert.id)}
                        title="Excluir alerta"
                        className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
