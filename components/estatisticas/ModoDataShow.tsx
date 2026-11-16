"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Moon,
  Sun,
  Trophy,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { GraficoTaxaComProjecao, type CoresGrafico, type PontoTaxa } from "./Graficos";
import type { LinhaClasse, LinhaRanking, RespPanorama, RespRanking } from "./tipos";

/**
 * Modo Data Show — o ranking no telão.
 *
 * ============================================================================
 * POR QUE NÃO É SÓ "A MESMA TELA EM TELA CHEIA"
 *
 * O portal é azul-escuro com texto semitransparente: lindo no celular, ruim no
 * projetor. Projetor não faz preto — faz "a cor da parede com a luz da sala
 * por cima". Com a janela aberta ou a luz acesa pela metade, o azul vira um
 * cinza lavado e o texto a 50% de opacidade simplesmente some.
 *
 * Então aqui:
 *   · DUAS paletas de alto contraste, sem nenhuma opacidade no texto:
 *       Claro  — fundo branco, letra preta. O melhor para salão iluminado ou
 *                luz irregular: o branco do projetor vence a luz ambiente.
 *       Escuro — fundo preto, letra branca e amarelo. Para sala escura, onde
 *                o branco cansaria a vista.
 *   · Letra grande, que acompanha o tamanho da tela, e botões A−/A+ para
 *     quem está no fundo da igreja.
 *   · Um assunto por slide, passando pelas setas, pelo passador de slides
 *     (que manda PageDown/PageUp) ou clicando na tela.
 *   · Os controles somem sozinhos depois de 3 segundos parados.
 *   · A tela do notebook não apaga no meio (Wake Lock, quando o navegador
 *     deixa).
 * ============================================================================
 */

type Tema = "claro" | "escuro";

interface Paleta {
  fundo: string;
  texto: string;
  secundario: string;
  destaque: string;
  medalha: string;
  trilho: string;
  grade: string;
  borda: string;
}

/*
 * Todos os pares texto/fundo passam de 7:1 (WCAG AAA). Nada de cinza-claro
 * sobre branco nem de dourado-claro sobre branco — no projetor, o que é
 * "contraste suficiente" no monitor deixa de ser.
 */
const PALETAS: Record<Tema, Paleta> = {
  claro: {
    fundo: "#FFFFFF",
    texto: "#000000",
    secundario: "#262626",
    destaque: "#0B1F45",
    medalha: "#7A5A00",
    trilho: "#DADADA",
    grade: "#BDBDBD",
    borda: "#000000",
  },
  escuro: {
    fundo: "#000000",
    texto: "#FFFFFF",
    secundario: "#EDEDED",
    destaque: "#FFD54A",
    medalha: "#FFD54A",
    trilho: "#333333",
    grade: "#555555",
    borda: "#FFFFFF",
  },
};

const PREFS = "ebd:datashow";
const ESCALAS = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
/** Linhas por slide: com a letra aumentada, cabem menos sem invadir o rodapé. */
const porPagina = (escala: number) => (escala >= 1.3 ? 4 : escala >= 1.15 ? 5 : 6);

function lerPrefs(): { tema: Tema; escala: number } {
  try {
    const p = JSON.parse(window.localStorage.getItem(PREFS) ?? "{}");
    return {
      tema: p.tema === "escuro" ? "escuro" : "claro",
      escala: ESCALAS.includes(p.escala) ? p.escala : 1,
    };
  } catch {
    return { tema: "claro", escala: 1 };
  }
}

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const presentes = (v: number) => `${dec(v)} ${v === 1 ? "presente" : "presentes"}`;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dataBr = (s: string) => fmtData.format(new Date(`${s}T12:00:00`));

type Slide =
  | { tipo: "capa" }
  | { tipo: "podio"; linhas: LinhaRanking[] }
  | { tipo: "ranking"; linhas: LinhaRanking[]; pagina: number; paginas: number }
  | { tipo: "poucas"; linhas: LinhaRanking[] }
  | { tipo: "classes"; linhas: LinhaClasse[] }
  | { tipo: "panorama" };

export function ModoDataShow({ de, ate, aoFechar }: { de: string; ate: string; aoFechar: () => void }) {
  const [montado, setMontado] = useState(false);
  const [tema, setTema] = useState<Tema>("claro");
  const [escala, setEscala] = useState(1);
  const [ranking, setRanking] = useState<RespRanking | null>(null);
  const [panorama, setPanorama] = useState<RespPanorama | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState(0);
  const [controles, setControles] = useState(true);
  const [telaCheia, setTelaCheia] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = lerPrefs();
    setTema(p.tema);
    setEscala(p.escala);
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    try {
      window.localStorage.setItem(PREFS, JSON.stringify({ tema, escala }));
    } catch {
      /* sem armazenamento: só não lembra da próxima vez */
    }
  }, [tema, escala, montado]);

  // ---------------- Dados ----------------
  useEffect(() => {
    const controle = new AbortController();
    const opcoes = { signal: controle.signal, cache: "no-store" as const };
    fetch(`/api/estatisticas/ranking?de=${de}&ate=${ate}`, opcoes)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setRanking)
      .catch((e: Error) => e.name !== "AbortError" && setErro("Não foi possível carregar o ranking."));
    fetch("/api/estatisticas/panorama", opcoes)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPanorama(d))
      .catch(() => {});
    return () => controle.abort();
  }, [de, ate]);

  const slides: Slide[] = useMemo(() => {
    if (!ranking) return [];
    const POR_PAGINA = porPagina(escala);
    const lista: Slide[] = [{ tipo: "capa" }];
    const classificadas = ranking.congregacoes;
    if (classificadas.length > 0) lista.push({ tipo: "podio", linhas: classificadas.slice(0, 3) });
    const paginas = Math.ceil(classificadas.length / POR_PAGINA);
    for (let i = 0; i < paginas; i++) {
      lista.push({ tipo: "ranking", linhas: classificadas.slice(i * POR_PAGINA, (i + 1) * POR_PAGINA), pagina: i + 1, paginas });
    }
    if (ranking.poucasChamadas.length > 0) lista.push({ tipo: "poucas", linhas: ranking.poucasChamadas.slice(0, POR_PAGINA) });
    if (ranking.classes.length > 0) lista.push({ tipo: "classes", linhas: ranking.classes.slice(0, POR_PAGINA) });
    if (panorama && panorama.serie.length > 0) lista.push({ tipo: "panorama" });
    return lista;
  }, [ranking, panorama, escala]);

  const total = slides.length;
  const ir = useCallback((passo: number) => setAtual((a) => Math.max(0, Math.min(total - 1, a + passo))), [total]);

  // ---------------- Tela cheia, tela acesa, controles ----------------
  const alternarTelaCheia = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await raiz.current?.requestFullscreen();
    } catch {
      /* navegador sem tela cheia (ex.: iPhone): segue na janela mesmo */
    }
  }, []);

  const fechar = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* já saiu */
    }
    aoFechar();
  }, [aoFechar]);

  useEffect(() => {
    // Ainda dentro do clique no botão "Data show": o navegador permite.
    void alternarTelaCheia();
    const aoMudar = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aoMudar);

    let trava: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((t) => (trava = t)).catch(() => {});

    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", aoMudar);
      void trava?.release().catch(() => {});
      document.body.style.overflow = rolagem;
    };
  }, [alternarTelaCheia]);

  const mostrarControles = useCallback(() => {
    setControles(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setControles(false), 3000);
  }, []);

  useEffect(() => {
    mostrarControles();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mostrarControles]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          ir(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          ir(-1);
          break;
        case "Home":
          setAtual(0);
          break;
        case "End":
          setAtual(total - 1);
          break;
        case "Escape":
          void fechar();
          break;
        case "+":
        case "=":
          setEscala((v) => ESCALAS[Math.min(ESCALAS.length - 1, ESCALAS.indexOf(v) + 1)]);
          break;
        case "-":
          setEscala((v) => ESCALAS[Math.max(0, ESCALAS.indexOf(v) - 1)]);
          break;
        case "c":
        case "C":
          setTema((t) => (t === "claro" ? "escuro" : "claro"));
          break;
        case "f":
        case "F":
          void alternarTelaCheia();
          break;
        default:
          return;
      }
      mostrarControles();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, total, fechar, alternarTelaCheia, mostrarControles]);

  if (!montado) return null;

  const c = PALETAS[tema];
  /** Tamanho que cresce com a tela e com o A+/A−. `base` em rem, `vw` o quanto acompanha a largura. */
  const t = (base: number, vw: number) => `calc(${escala} * max(${base}rem, ${vw}vw))`;
  const slide = slides[Math.min(atual, total - 1)];

  return createPortal(
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label="Modo data show"
      onMouseMove={mostrarControles}
      onTouchStart={mostrarControles}
      className="fixed inset-0 z-[300] flex flex-col overflow-hidden"
      style={{ background: c.fundo, color: c.texto, cursor: controles ? "default" : "none" }}
    >
      {/* ---------------- O slide ---------------- */}
      {/* Clicar no slide avança (as setas e o passador também). Um <div>, e não um
          <button>: botão não pode conter título e lista. */}
      <div onClick={() => ir(1)} className="flex min-h-0 flex-1 flex-col overflow-hidden px-[5vw] pb-[2vh] pt-[4vh]">
        {erro ? (
          <p style={{ fontSize: t(2, 3) }}>{erro}</p>
        ) : !ranking || !slide ? (
          <p style={{ fontSize: t(2, 3), color: c.secundario }}>Carregando…</p>
        ) : (
          <ConteudoDoSlide slide={slide} ranking={ranking} panorama={panorama} c={c} t={t} tema={tema} escala={escala} />
        )}
      </div>

      {/* ---------------- Rodapé fixo: o período, sempre visível ---------------- */}
      {ranking && (
        <div
          className="flex items-center justify-between gap-4 px-[5vw] py-[1.6vh]"
          style={{ borderTop: `2px solid ${c.borda}`, fontSize: t(1, 1.3), color: c.secundario }}
        >
          <span>
            EBD ·{" "}
            {ranking.periodo.de === ranking.periodo.ate
              ? `Domingo ${dataBr(ranking.periodo.de)}`
              : `${dataBr(ranking.periodo.de)} a ${dataBr(ranking.periodo.ate)}`}
          </span>
          <span className="tabular-nums">
            {Math.min(atual, total - 1) + 1} / {total}
          </span>
        </div>
      )}

      {/* ---------------- Controles (somem sozinhos) ---------------- */}
      <div
        className="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-2 transition-opacity duration-300"
        style={{ opacity: controles ? 1 : 0, pointerEvents: controles ? "auto" : "none" }}
      >
        {[
          { rotulo: "Slide anterior", icone: ChevronLeft, acao: () => ir(-1), desabilitado: atual === 0 },
          { rotulo: "Próximo slide", icone: ChevronRight, acao: () => ir(1), desabilitado: atual >= total - 1 },
          {
            rotulo: "Diminuir letra",
            icone: ZoomOut,
            acao: () => setEscala((v) => ESCALAS[Math.max(0, ESCALAS.indexOf(v) - 1)]),
            desabilitado: escala === ESCALAS[0],
          },
          {
            rotulo: "Aumentar letra",
            icone: ZoomIn,
            acao: () => setEscala((v) => ESCALAS[Math.min(ESCALAS.length - 1, ESCALAS.indexOf(v) + 1)]),
            desabilitado: escala === ESCALAS[ESCALAS.length - 1],
          },
          {
            rotulo: tema === "claro" ? "Fundo escuro (sala escura)" : "Fundo claro (sala iluminada)",
            icone: tema === "claro" ? Moon : Sun,
            acao: () => setTema((v) => (v === "claro" ? "escuro" : "claro")),
          },
          { rotulo: telaCheia ? "Sair da tela cheia" : "Tela cheia", icone: telaCheia ? Minimize : Maximize, acao: () => void alternarTelaCheia() },
          { rotulo: "Fechar data show", icone: X, acao: () => void fechar() },
        ].map((b) => {
          const Icone = b.icone;
          return (
            <button
              key={b.rotulo}
              type="button"
              onClick={b.acao}
              disabled={b.desabilitado}
              title={b.rotulo}
              aria-label={b.rotulo}
              className="flex h-12 w-12 items-center justify-center rounded-xl disabled:opacity-30"
              style={{ background: c.fundo, color: c.texto, border: `2px solid ${c.borda}` }}
            >
              <Icone className="h-6 w-6" />
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */

function Titulo({ texto, sub, c, t }: { texto: string; sub?: string; c: Paleta; t: (b: number, v: number) => string }) {
  return (
    <div className="mb-[2.5vh] shrink-0">
      <h1 className="font-display font-bold uppercase leading-tight" style={{ fontSize: t(2.2, 3.6), letterSpacing: "0.04em" }}>
        {texto}
      </h1>
      {sub && (
        <p className="mt-[0.6vh]" style={{ fontSize: t(1.2, 1.7), color: c.secundario }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Barra({ taxa, c }: { taxa: number | null; c: Paleta }) {
  return (
    <div className="h-[1.4vh] min-h-[10px] w-full overflow-hidden rounded-full" style={{ background: c.trilho }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, taxa ?? 0))}%`, background: c.destaque }} />
    </div>
  );
}

function ListaGrande({
  linhas,
  c,
  t,
}: {
  linhas: Array<{ chave: number; posicao: string; nome: string; detalhe: string; taxa: number | null }>;
  c: Paleta;
  t: (b: number, v: number) => string;
}) {
  return (
    // Empilhadas do topo, com espaço fixo: com "justify-around", um último
    // slide de duas linhas espalhava as duas pela tela inteira.
    <ol className="flex min-h-0 flex-1 flex-col gap-[3.2vh]">
      {linhas.map((l) => (
        <li key={l.chave} className="flex items-center gap-[2vw]">
          <span className="w-[6vw] shrink-0 text-right font-bold tabular-nums" style={{ fontSize: t(1.6, 2.6) }}>
            {l.posicao}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight" style={{ fontSize: t(1.3, 2) }}>
              {l.nome}
            </p>
            <Barra taxa={l.taxa} c={c} />
            <p className="mt-[0.3vh] truncate leading-tight" style={{ fontSize: t(0.9, 1.15), color: c.secundario }}>
              {l.detalhe}
            </p>
          </div>
          <span className="w-[14vw] shrink-0 text-right font-bold tabular-nums" style={{ fontSize: t(1.8, 3) }}>
            {pct(l.taxa)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ConteudoDoSlide({
  slide,
  ranking,
  panorama,
  c,
  t,
  tema,
  escala,
}: {
  escala: number;
  slide: Slide;
  ranking: RespRanking;
  panorama: RespPanorama | null;
  c: Paleta;
  t: (b: number, v: number) => string;
  tema: Tema;
}) {
  const coresGrafico: CoresGrafico = {
    linha: c.destaque,
    eixo: c.texto,
    grade: c.grade,
    fundo: c.fundo,
    texto: c.texto,
    // O eixo acompanha a tela (≈ 24px num 1920) e o A+/A−: 16px fixos somem no telão.
    tamanhoEixo: Math.round(Math.max(16, window.innerWidth / 80) * escala),
  };

  switch (slide.tipo) {
    case "capa":
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-semibold uppercase" style={{ fontSize: t(1.3, 2), letterSpacing: "0.2em", color: c.secundario }}>
            Escola Bíblica Dominical
          </p>
          <h1 className="mt-[2vh] font-display font-bold uppercase leading-tight" style={{ fontSize: t(3, 5.5) }}>
            Ranking de presença
          </h1>
          <p className="mt-[1vh]" style={{ fontSize: t(1.3, 2), color: c.secundario }}>
            presentes diante dos matriculados
          </p>
          <p className="mt-[5vh] font-bold tabular-nums" style={{ fontSize: t(5, 11), color: c.destaque, lineHeight: 1 }}>
            {pct(ranking.campo.taxa)}
          </p>
          <p className="mt-[2vh]" style={{ fontSize: t(1.4, 2.2) }}>
            presença do campo · {presentes(ranking.campo.mediaPresentes)} por domingo
          </p>
        </div>
      );

    case "podio": {
      // 2º · 1º · 3º — o 1º no meio e mais alto, como num pódio de verdade.
      const ordem = [slide.linhas[1], slide.linhas[0], slide.linhas[2]];
      const alturas = ["62%", "82%", "48%"];
      const lugares = [2, 1, 3];
      return (
        <>
          <Titulo texto="Os três primeiros" c={c} t={t} />
          <div className="flex min-h-0 flex-1 items-end justify-center gap-[2.5vw]">
            {ordem.map((l, i) =>
              l ? (
                <div key={l.congId} className="flex h-full w-[27vw] flex-col justify-end text-center">
                  <p className="font-semibold leading-tight" style={{ fontSize: t(1.4, 2.3) }}>
                    {l.nome}
                  </p>
                  <p className="mb-[1.5vh] mt-[0.5vh] font-bold tabular-nums" style={{ fontSize: t(2, 3.8), color: c.destaque }}>
                    {pct(l.taxa)}
                  </p>
                  <div
                    className="flex flex-col items-center justify-start rounded-t-2xl pt-[2vh]"
                    style={{
                      height: alturas[i],
                      background: lugares[i] === 1 ? c.destaque : c.trilho,
                      color: lugares[i] === 1 ? c.fundo : c.texto,
                      border: `3px solid ${c.borda}`,
                    }}
                  >
                    {lugares[i] === 1 && <Trophy style={{ width: t(2.5, 4), height: t(2.5, 4) }} />}
                    <span className="font-display font-bold" style={{ fontSize: t(2.4, 5) }}>
                      {lugares[i]}º
                    </span>
                  </div>
                </div>
              ) : (
                <div key={i} className="w-[27vw]" />
              ),
            )}
          </div>
        </>
      );
    }

    case "ranking":
      return (
        <>
          <Titulo
            texto={slide.paginas > 1 ? `Classificação (${slide.pagina}/${slide.paginas})` : "Classificação"}
            sub="Presentes ÷ matriculados, na média dos domingos com chamada"
            c={c}
            t={t}
          />
          <ListaGrande
            c={c}
            t={t}
            linhas={slide.linhas.map((l) => ({
              chave: l.congId,
              posicao: `${l.posicao}º`,
              nome: l.nome,
              detalhe: `${presentes(l.mediaPresentes)} de ${dec(l.mediaBase)} por domingo · ${l.matriculados} matriculados`,
              taxa: l.taxa,
            }))}
          />
        </>
      );

    case "poucas":
      return (
        <>
          <Titulo texto="Fora da classificação" sub="Chamada em menos da metade dos domingos do período" c={c} t={t} />
          <ListaGrande
            c={c}
            t={t}
            linhas={slide.linhas.map((l) => ({
              chave: l.congId,
              posicao: "–",
              nome: l.nome,
              detalhe: `chamada em ${l.domingosComChamada} de ${ranking.periodo.domingos} domingos`,
              taxa: l.taxa,
            }))}
          />
        </>
      );

    case "classes":
      return (
        <>
          <Titulo texto="Classes com mais presença" c={c} t={t} />
          <ListaGrande
            c={c}
            t={t}
            linhas={slide.linhas.map((l) => ({
              chave: l.classeId,
              posicao: `${l.posicao}º`,
              nome: l.congregacao ? `${l.nome} · ${l.congregacao}` : l.nome,
              detalhe: `${presentes(l.mediaPresentes)} de ${dec(l.mediaBase)} por domingo`,
              taxa: l.taxa,
            }))}
          />
        </>
      );

    case "panorama": {
      if (!panorama) return null;
      const reais: PontoTaxa[] = panorama.serie.map((p) => ({ data: p.data, taxa: p.taxa, projetada: null }));
      if (panorama.projecao.length > 0 && reais.length > 0) {
        reais[reais.length - 1] = { ...reais[reais.length - 1], projetada: reais[reais.length - 1].taxa };
      }
      const pontos = [...reais, ...panorama.projecao.map((p) => ({ data: p.data, taxa: null, projetada: p.taxa }))];
      const fim = panorama.projecao[panorama.projecao.length - 1];
      return (
        <>
          <Titulo
            texto="Presença do campo"
            sub={fim ? `Linha cheia: o que aconteceu · tracejada: projeção (${pct(fim.taxa)} em 4 semanas)` : "Domingo a domingo"}
            c={c}
            t={t}
          />
          <div className="min-h-0 flex-1" key={`${tema}-${escala}`}>
            <GraficoTaxaComProjecao dados={pontos} cores={coresGrafico} className="h-full w-full" />
          </div>
        </>
      );
    }
  }
}
