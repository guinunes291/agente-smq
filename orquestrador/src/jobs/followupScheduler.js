// Scheduler de follow-up: o loop que torna o agente PROATIVO.
// Varre os leads, encontra os com proxima acao vencida e dispara o reengajamento,
// respeitando: kill-switch global, opt-out, handoff, pausa, rate-limit, horario
// comercial, maximo de toques e a JANELA DE 24h da Meta (fora dela -> template HSM).
// Tudo passa por Compliance antes de enviar.
import { config } from '../config.js';
import { allLeads, saveLead, pushHistory, markSent, within24h, isGlobalPaused } from '../state.js';
import { rateLimitOk, isBusinessHours, sleep, humanDelay } from '../guards.js';
import { gerarFollowup } from '../agent.js';
import { revisarMensagem } from '../agents/compliance.js';
import { sendText, sendTemplate } from '../whatsapp/send.js';
import { emit } from '../telemetry/events.js';
import { pseudonimo } from '../lib/normalize.js';

const MAX_TOUCHES = Number(process.env.FOLLOWUP_MAX_TOUCHES) || 4;
const DIA = 24 * 3600 * 1000;
// Intervalo (dias) ate o PROXIMO follow-up, por temperatura.
const PROXIMO_DIAS = { PRONTO: 1, QUENTE: 1, MORNO: 3, FRIO: 7 };

// Um lead esta elegivel para follow-up agora?
export function elegivel(lead, now) {
  if (!lead.agentManaged) return false;
  if (lead.optOut || lead.handoff || lead.paused) return false;
  if ((lead.followupsSent || 0) >= MAX_TOUCHES) return false;
  const ts = lead.proximaAcao?.proximaAcaoTs;
  if (!ts || ts > now) return false;
  if (!rateLimitOk(lead)) return false;
  return true;
}

/**
 * Roda 1 ciclo do scheduler. Injetavel para teste (sender/gerador/now).
 * @returns {Promise<{enviados:number, pulados:number, detalhes:object[]}>}
 */
export async function runFollowupCycle({
  now = Date.now(),
  sender = sendText,
  templateSender = sendTemplate,
  gerar = gerarFollowup,
  respeitarHorario = true,
  comDelay = false,
} = {}) {
  const resumo = { enviados: 0, pulados: 0, detalhes: [] };

  if (isGlobalPaused()) {
    resumo.motivo = 'global_pause';
    return resumo;
  }
  if (respeitarHorario && !isBusinessHours(new Date(now))) {
    resumo.motivo = 'fora_horario';
    return resumo;
  }

  for (const lead of allLeads()) {
    if (!elegivel(lead, now)) {
      resumo.pulados += 1;
      continue;
    }

    const intencao = lead.proximaAcao?.intencao || 'reativar_com_novidade';
    const canal = (lead.origem || '').includes('zapi') ? 'zapi' : config.replyChannel;
    const phoneHash = pseudonimo(lead.phone);

    try {
      let enviado = false;
      let mensagem = null;

      // Janela 24h da Meta: fora dela, texto livre e proibido -> usar template HSM aprovado.
      const foraDaJanela = canal === 'meta' && !within24h(lead);
      if (foraDaJanela) {
        await templateSender(lead.phone, 'reativacao_base', [lead.nome || 'tudo bem', lead.empreendimentoInteresse || 'novidades']);
        mensagem = '[template reativacao_base]';
        enviado = true;
      } else {
        const bruta = await gerar(lead, intencao);
        const comp = revisarMensagem(bruta, lead);
        mensagem = comp.approved ? comp.revisedMessage || bruta : null;
        if (!mensagem) {
          // Compliance bloqueou -> nao envia; registra e segue.
          emit({ phoneHash, agent: 'followup', type: 'bloqueado', meta: { intencao } });
          resumo.detalhes.push({ phone: phoneHash, status: 'compliance_block' });
          continue;
        }
        if (comDelay) await sleep(humanDelay());
        await sender(lead.phone, mensagem, canal);
        enviado = true;
      }

      if (enviado) {
        pushHistory(lead, 'assistant', mensagem);
        markSent(lead);
        lead.followupsSent = (lead.followupsSent || 0) + 1;
        lead.lastFollowupTs = now;
        // agenda o proximo (ou encerra a cadencia ao atingir o maximo)
        if (lead.followupsSent >= MAX_TOUCHES) {
          lead.proximaAcao = { ...(lead.proximaAcao || {}), intencao, proximaAcaoTs: null, encerrado: true };
        } else {
          const dias = PROXIMO_DIAS[lead.temperatura] || 3;
          lead.proximaAcao = { ...(lead.proximaAcao || {}), intencao, proximaAcaoTs: now + dias * DIA };
        }
        saveLead(lead);
        emit({ phoneHash, agent: 'followup', type: 'enviado', kpi: 'taxa_reengajamento', value: 1, meta: { intencao, foraDaJanela } });
        resumo.enviados += 1;
        resumo.detalhes.push({ phone: phoneHash, status: 'enviado', foraDaJanela });
      }
    } catch (e) {
      console.error('[followup] falha ao enviar para', pseudonimo(lead.phone), e.message);
      resumo.detalhes.push({ phone: pseudonimo(lead.phone), status: 'erro', erro: e.message });
    }
  }
  return resumo;
}

let _timer = null;

/** Inicia o loop periodico (default: a cada 15 min). */
export function startFollowupScheduler({ intervaloMs = Number(process.env.FOLLOWUP_INTERVAL_MS) || 15 * 60 * 1000 } = {}) {
  if (_timer) return _timer;
  _timer = setInterval(() => {
    runFollowupCycle({ comDelay: true }).then((r) => {
      if (r.enviados) console.log(`[followup] ciclo: ${r.enviados} enviados, ${r.pulados} pulados`);
    });
  }, intervaloMs);
  _timer.unref?.(); // nao segura o processo vivo so por causa do timer
  console.log(`[followup] scheduler ativo (a cada ${Math.round(intervaloMs / 60000)} min)`);
  return _timer;
}

export function stopFollowupScheduler() {
  if (_timer) clearInterval(_timer);
  _timer = null;
}
