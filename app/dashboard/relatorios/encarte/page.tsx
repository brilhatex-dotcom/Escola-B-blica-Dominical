"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Medal, Share2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { LOGO_SRC } from "@/lib/brand";
import { domingoMaisRecente } from "@/lib/dashboard/formato";

/**
 * Encarte de Destaques — o Top 3 de presença de um domingo, como imagem
 * pronta pra WhatsApp.
 *
 * ============================================================================
 * A PRÉVIA É A PRÓPRIA ARTE, EM TAMANHO REAL — SÓ ENCOLHIDA NA TELA
 *
 * `EncarteArte` sempre nasce com 1080×1350px de verdade (é o `style` dela,
 * não um valor decorativo). O que muda entre a prévia e o arquivo baixado é
 * só um `transform: scale()` no elemento PAI, puramente visual — não afeta
 * `offsetWidth`/`offsetHeight`, que é o que a `html-to-image` lê para
 * decidir o tamanho do JPG. Por isso o arquivo final sai sempre exatamente
 * 1080×1350, em qualquer tela, sem precisar gerar a arte duas vezes.
 * ============================================================================
 */

interface CongLinha { id: number; nome: string; matriculados: number; presentes: number; percentual: number }
interface DadosEncarte { data: string; congregacoes: CongLinha[]; valido: boolean; motivo: string | null }

const MENSAGEM_PADRAO =
  "Que alegria ver o empenho e a dedicação de vocês no estudo da Palavra de Deus. Continuem firmes nesse propósito, pois o conhecimento das Escrituras é o nosso maior tesouro!";
const VERSICULO_PADRAO =
  "Procura apresentar-te a Deus aprovado, como obreiro que não tem de que se envergonhar, que maneja bem a palavra da verdade.";
const REFERENCIA_PADRAO = "2 Timóteo 2:15";

const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

const PODIO = [
  { cor: "#c9a227", corTexto: "#8a6d1a", rotulo: "1º" },
  { cor: "#9aa1ab", corTexto: "#5c636c", rotulo: "2º" },
  { cor: "#b5651d", corTexto: "#7a4514", rotulo: "3º" },
] as const;

function EncarteCard({ posicao, linha }: { posicao: 0 | 1 | 2; linha: CongLinha }) {
  const p = PODIO[posicao];
  return (
    <div
      style={{
        border: `2px solid ${p.cor}`,
        borderRadius: 22,
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: "white",
      }}
    >
      <div
        style={{
          width: 68, height: 68, borderRadius: "50%", flexShrink: 0,
          background: p.cor, color: "white", fontWeight: 800, fontSize: 26,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {p.rotulo}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 30, fontWeight: 800, color: "#14213d", lineHeight: 1.2, margin: 0, wordBreak: "break-word" }}>
          {linha.nome}
        </p>
        <p style={{ fontSize: 19, color: "#6b7280", margin: "6px 0 0" }}>
          Presença: {linha.presentes} de {linha.matriculados} alunos
        </p>
      </div>
      <p style={{ fontSize: 40, fontWeight: 800, color: "#1e8a5a", margin: 0, flexShrink: 0 }}>
        {linha.percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
      </p>
    </div>
  );
}

function EncarteArte({ dados, mensagem, versiculo, referencia, encarteRef }: {
  dados: DadosEncarte; mensagem: string; versiculo: string; referencia: string;
  encarteRef: React.RefObject<HTMLDivElement | null>;
}) {
  const top3 = dados.congregacoes.slice(0, 3);
  return (
    <div
      ref={encarteRef}
      style={{
        width: 1080, height: 1350, background: "#f5f1e6", fontFamily: "var(--font-sans, sans-serif)",
        padding: 48, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 40,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ background: "#0f1f3d", borderRadius: 28, padding: "36px 40px", display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{
          width: 110, height: 110, borderRadius: "50%", background: "white", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 10, boxSizing: "border-box",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- captura por html-to-image precisa de <img> direto, sem o pipeline de otimização do next/image */}
          <img src={LOGO_SRC} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 44, fontWeight: 800, color: "white", margin: 0, lineHeight: 1.1, letterSpacing: 0.5 }}>DESTAQUES DA EBD</p>
          <p style={{ fontSize: 19, color: "#c7cedd", margin: "8px 0 0", lineHeight: 1.35 }}>
            Reconhecendo dedicação, presença<br />e amor pela Palavra de Deus
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#d9b34a", margin: "10px 0 0", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {fmtDataLonga.format(new Date(`${dados.data}T12:00:00`)).toUpperCase()}
          </p>
        </div>
      </div>

      {/* Título e mensagem */}
      <div>
        <p style={{ fontSize: 28, fontWeight: 800, color: "#14213d", margin: 0 }}>🏆 PARABÉNS AOS NOSSOS DESTAQUES!</p>
        <p style={{ fontSize: 19, color: "#3f4756", lineHeight: 1.5, margin: "12px 0 0" }}>{mensagem}</p>
      </div>

      {/* Ranking */}
      <div>
        <p style={{ fontSize: 26, fontWeight: 800, color: "#14213d", margin: "0 0 24px" }}>RANKING DE PRESENÇA</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {top3.map((l, i) => <EncarteCard key={l.id} posicao={i as 0 | 1 | 2} linha={l} />)}
        </div>
        <p style={{ fontSize: 16, color: "#8a92a3", margin: "22px 0 0" }}>
          {dados.congregacoes.length} congregaç{dados.congregacoes.length === 1 ? "ão participou" : "ões participaram"} da chamada neste domingo
        </p>
      </div>

      {/* Versículo — encostado no rodapé do cartão, não solto no meio do vazio */}
      <div style={{ marginTop: "auto", background: "#e9e2cf", borderLeft: "6px solid #c9a227", borderRadius: 12, padding: "22px 26px" }}>
        <p style={{ fontSize: 18, fontStyle: "italic", color: "#3f4756", lineHeight: 1.5, margin: 0 }}>&ldquo;{versiculo}&rdquo;</p>
        <p style={{ fontSize: 17, fontWeight: 800, color: "#8a6d1a", textAlign: "right", margin: "10px 0 0" }}>{referencia}</p>
      </div>
    </div>
  );
}

export default function EncartePage() {
  const [data, setData] = useState(domingoMaisRecente());
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO);
  const [versiculo, setVersiculo] = useState(VERSICULO_PADRAO);
  const [referencia, setReferencia] = useState(REFERENCIA_PADRAO);

  const [dados, setDados] = useState<DadosEncarte | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"jpg" | "compartilhar" | null>(null);
  const [erroExportar, setErroExportar] = useState<string | null>(null);

  const encarteRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.4);
  const molduraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios/encarte", window.location.origin);
        url.searchParams.set("data", data);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar os dados do encarte.");
      }
    })();
    return () => controle.abort();
  }, [data]);

  // A prévia se ajusta à largura do painel — a arte continua 1080×1350
  // de verdade por baixo, só a escala visual muda.
  useEffect(() => {
    function ajustar() {
      const largura = molduraRef.current?.clientWidth ?? 380;
      setEscala(Math.min(0.5, largura / 1080));
    }
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  async function gerarJpeg(): Promise<Blob | null> {
    if (!encarteRef.current) return null;
    const { toBlob } = await import("html-to-image");
    return toBlob(encarteRef.current, { quality: 0.93, pixelRatio: 1, width: 1080, height: 1350 });
  }

  async function baixarJpg() {
    setErroExportar(null);
    setExportando("jpg");
    try {
      const blob = await gerarJpeg();
      if (!blob) throw new Error();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `encarte-ebd-${data}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setErroExportar("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  async function compartilhar() {
    setErroExportar(null);
    setExportando("compartilhar");
    try {
      const blob = await gerarJpeg();
      if (!blob) throw new Error();
      const arquivo = new File([blob], `encarte-ebd-${data}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: "Destaques da EBD" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `encarte-ebd-${data}.jpg`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErroExportar("Não foi possível compartilhar a imagem. Tente baixar o JPG.");
    } finally {
      setExportando(null);
    }
  }

  return (
    <>
      <Link href="/dashboard/relatorios" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Painel de Relatórios
      </Link>

      <CabecalhoModulo icone={Trophy} titulo="Encarte de Destaques" descricao="O Top 3 de presença do domingo, pronto para divulgar no grupo" />

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <EsqueletoLista linhas={6} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          {/* Formulário */}
          <div className="glass-panel space-y-4 rounded-2xl p-4">
            <label className="block">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Data da EBD</span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={cn(campoBase, "[color-scheme:dark]")}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Mensagem</span>
              <textarea
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className={cn(campoBase, "h-auto py-2.5 leading-relaxed")}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Versículo</span>
              <textarea
                rows={3}
                value={versiculo}
                onChange={(e) => setVersiculo(e.target.value)}
                className={cn(campoBase, "h-auto py-2.5 leading-relaxed")}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Referência</span>
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={campoBase} />
            </label>

            {dados.valido && (
              <div className="space-y-2 border-t border-white/8 pt-4">
                <Button className="w-full" onClick={() => void baixarJpg()} disabled={exportando !== null}>
                  {exportando === "jpg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Baixar JPG
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => void compartilhar()} disabled={exportando !== null}>
                  {exportando === "compartilhar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  Compartilhar
                </Button>
                {erroExportar && <p className="text-[0.78rem] text-flame-400">{erroExportar}</p>}
              </div>
            )}
          </div>

          {/* Prévia */}
          <div ref={molduraRef} className="glass-panel flex min-h-[30rem] items-start justify-center overflow-hidden rounded-2xl p-4">
            {!dados.valido ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
                <Medal className="h-8 w-8 text-brand-200/40" />
                <p className="max-w-xs text-[0.86rem] text-brand-100/80">{dados.motivo}</p>
                <p className="max-w-xs text-[0.76rem] text-brand-200/50">Escolha outro domingo com mais chamadas registradas.</p>
              </div>
            ) : (
              <div style={{ width: 1080 * escala, height: 1350 * escala, overflow: "hidden" }}>
                <div style={{ transform: `scale(${escala})`, transformOrigin: "top left" }}>
                  <EncarteArte dados={dados} mensagem={mensagem} versiculo={versiculo} referencia={referencia} encarteRef={encarteRef} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const campoBase = cn(
  "h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3",
  "text-[0.86rem] text-brand-50 placeholder:text-brand-200/35",
  "transition-colors duration-300 focus:border-gold-400/35 focus:outline-none",
  "disabled:opacity-50",
);
