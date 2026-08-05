import { db, temBancoLocal } from "@/lib/db/local";

/**
 * Busca sobre o espelho do aparelho — o que atende quando a internet cai.
 *
 * ============================================================================
 * O MESMO DESENHO DE RESULTADO DO SERVIDOR
 *
 * A barra de busca não sabe (nem precisa saber) se um resultado veio do Postgres
 * ou do IndexedDB: os dois devolvem `Grupo[]` com o mesmo formato. É o que
 * permite a busca continuar funcionando sem sinal sem reescrever a interface —
 * troca-se a fonte, não a tela.
 *
 * O recorte por congregação NÃO é refeito aqui: o espelho local já desceu
 * recortado (ver app/api/sincronizar). O aparelho só guarda o que o acesso
 * daquele usuário enxerga, então buscar em tudo que está guardado é buscar
 * dentro do recorte — sem uma segunda regra para divergir da primeira.
 * ============================================================================
 */

export interface AchadoLocal {
  id: number;
  titulo: string;
  subtitulo: string;
  href: string;
}
export interface GrupoLocal {
  chave: string;
  secao: string;
  itens: AchadoLocal[];
}

/** Ignora acento e caixa: "joao" acha "João". */
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const POR_CATEGORIA = 6;

/**
 * `podeVer` é passado de fora (o AcessoProvider já sabe): mesmo com o dado no
 * aparelho, uma categoria que o acesso não enxerga não entra no resultado. O
 * espelho desce recortado, mas a checagem aqui é o cinto de segurança para o
 * caso de um cache antigo ter sobrado de um acesso anterior no mesmo navegador.
 */
export async function buscarLocal(
  termo: string,
  podeVer: (chave: string) => boolean,
): Promise<GrupoLocal[]> {
  const t = normalizar(termo.trim());
  if (t.length < 2 || !temBancoLocal()) return [];

  const banco = db();
  const grupos: GrupoLocal[] = [];

  if (podeVer("alunos")) {
    const alunos = (await banco.alunos.filter((a) => a.ativo && normalizar(a.nome).includes(t)).toArray())
      .slice(0, POR_CATEGORIA);
    if (alunos.length > 0) {
      grupos.push({
        chave: "alunos",
        secao: "Alunos",
        itens: alunos.map((a) => ({
          id: a.idRemoto ?? 0,
          titulo: a.nome,
          subtitulo: a.tel ? `Tel. ${a.tel}` : "Aluno",
          href: a.idRemoto ? `/dashboard/relatorios/ficha?aluno=${a.idRemoto}` : "/dashboard/alunos",
        })),
      });
    }
  }

  if (podeVer("classes")) {
    const classes = (await banco.classes.filter((c) => normalizar(c.nome).includes(t)).toArray())
      .slice(0, POR_CATEGORIA);
    if (classes.length > 0) {
      grupos.push({
        chave: "classes",
        secao: "Classes",
        itens: classes.map((c) => ({
          id: c.idRemoto ?? 0,
          titulo: c.nome,
          subtitulo: c.faixa || "Classe",
          href: `/dashboard/classes?busca=${encodeURIComponent(c.nome)}`,
        })),
      });
    }
  }

  if (podeVer("congregacoes")) {
    const congs = (await banco.congregacoes.filter((c) => normalizar(c.nome).includes(t)).toArray())
      .slice(0, POR_CATEGORIA);
    if (congs.length > 0) {
      grupos.push({
        chave: "congregacoes",
        secao: "Congregações",
        itens: congs.map((c) => ({
          id: c.idRemoto ?? 0,
          titulo: c.nome,
          subtitulo: "Congregação",
          href: "/dashboard/congregacoes",
        })),
      });
    }
  }

  if (podeVer("visitantes")) {
    const visitantes = (await banco.visitantes.filter((v) => normalizar(v.nome).includes(t)).toArray())
      .slice(0, POR_CATEGORIA);
    if (visitantes.length > 0) {
      grupos.push({
        chave: "visitantes",
        secao: "Visitantes",
        itens: visitantes.map((v) => ({
          id: v.idRemoto ?? 0,
          titulo: v.nome,
          subtitulo: "Visitante",
          href: "/dashboard/visitantes",
        })),
      });
    }
  }

  return grupos;
}
