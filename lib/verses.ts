/**
 * Versiculos exibidos na tela de login (um diferente a cada acesso).
 *
 * Esta lista espelha a aba `Versiculos` do export do sistema antigo — os mesmos
 * textos que a igreja ja usava. Quando o banco estiver no ar, troque por uma
 * leitura de `prisma.versiculo.findMany({ where: { ativo: true } })`; o formato
 * do objeto e identico, entao nada mais precisa mudar.
 */

export interface Versiculo {
  ref: string;
  texto: string;
}

export const VERSICULOS: readonly Versiculo[] = [
  { ref: "Josué 1:8", texto: "Não se aparte da tua boca o livro desta lei; antes medita nele dia e noite, para que tenhas cuidado de fazer conforme a tudo quanto nele está escrito; porque então farás prosperar o teu caminho, e serás bem sucedido." },
  { ref: "João 3:16", texto: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
  { ref: "Salmos 23:1", texto: "O Senhor é o meu pastor; nada me faltará." },
  { ref: "Filipenses 4:13", texto: "Posso todas as coisas naquele que me fortalece." },
  { ref: "Provérbios 22:6", texto: "Ensina a criança no caminho em que deve andar, e até quando envelhecer não se desviará dele." },
  { ref: "Salmos 37:4", texto: "Deleita-te também no Senhor, e ele te concederá o que deseja o teu coração." },
  { ref: "Deuteronômio 31:6", texto: "Sede fortes e corajosos; não temais, nem vos assusteis diante deles, porque o Senhor, vosso Deus, é quem vai convosco." },
  { ref: "Mateus 11:28", texto: "Vinde a mim, todos os que estais cansados e sobrecarregados, e eu vos aliviarei." },
  { ref: "Romanos 12:21", texto: "Não te deixes vencer do mal, mas vence o mal com o bem." },
  { ref: "Isaías 40:31", texto: "Mas os que esperam no Senhor renovarão as suas forças, subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão." },
  { ref: "Salmos 51:10", texto: "Cria em mim, ó Deus, um coração puro, e renova em mim um espírito reto." },
  { ref: "Mateus 6:33", texto: "Mas, buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas." },
  { ref: "Salmos 119:105", texto: "Lâmpada para os meus pés é tua palavra, e luz para o meu caminho." },
  { ref: "Provérbios 3:5-6", texto: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas." },
  { ref: "Josué 1:9", texto: "Não to mandei eu? Esforça-te, e tem bom ânimo; não temas, nem te espantes; porque o Senhor, teu Deus, é contigo, por onde quer que andares." },
  { ref: "1 Coríntios 13:13", texto: "Agora, pois, permanecem a fé, a esperança e o amor, estes três; mas o maior destes é o amor." },
  { ref: "Jeremias 29:11", texto: "Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais." },
  { ref: "Romanos 8:28", texto: "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito." },
  { ref: "Salmos 46:1", texto: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." },
  { ref: "Mateus 5:16", texto: "Assim resplandeça a vossa luz diante dos homens, para que vejam as vossas boas obras e glorifiquem a vosso Pai, que está nos céus." },
  { ref: "2 Timóteo 1:7", texto: "Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação." },
  { ref: "Hebreus 11:1", texto: "Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não veem." },
  { ref: "Salmos 91:1", texto: "Aquele que habita no esconderijo do Altíssimo, à sombra do Onipotente descansará." },
  { ref: "1 Pedro 5:7", texto: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós." },
  { ref: "Gálatas 5:22-23", texto: "Mas o fruto do Espírito é: amor, gozo, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança." },
  { ref: "Provérbios 16:3", texto: "Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos." },
  { ref: "Salmos 27:1", texto: "O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; de quem me recearei?" },
  { ref: "Mateus 28:19", texto: "Portanto ide, fazei discípulos de todas as nações, batizando-os em nome do Pai, e do Filho, e do Espírito Santo." },
  { ref: "João 14:6", texto: "Disse-lhe Jesus: Eu sou o caminho, e a verdade, e a vida; ninguém vem ao Pai senão por mim." },
  { ref: "Atos 1:8", texto: "Mas recebereis a virtude do Espírito Santo, que há de vir sobre vós; e ser-me-eis testemunhas tanto em Jerusalém, como em toda a Judeia e Samaria, e até aos confins da terra." },
  { ref: "Romanos 10:9", texto: "A saber: Se com a tua boca confessares ao Senhor Jesus, e em teu coração creres que Deus o ressuscitou dentre os mortos, serás salvo." },
  { ref: "Efésios 2:8", texto: "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós, é dom de Deus." },
  { ref: "Tiago 1:5", texto: "E, se algum de vós tem falta de sabedoria, peça-a a Deus, que a todos dá liberalmente, e o não lança em rosto, e ser-lhe-á dada." },
  { ref: "Salmos 1:1", texto: "Bem-aventurado o varão que não anda segundo o conselho dos ímpios, nem se detém no caminho dos pecadores, nem se assenta na roda dos escarnecedores." },
  { ref: "Isaías 41:10", texto: "Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus; eu te fortaleço, e te ajudo, e te sustento com a destra da minha justiça." },
  { ref: "Mateus 7:7", texto: "Pedi, e dar-se-vos-á; buscai, e encontrareis; batei, e abrir-se-vos-á." },
  { ref: "Salmos 34:8", texto: "Provai e vede que o Senhor é bom; bem-aventurado o homem que nele confia." },
  { ref: "Romanos 5:8", texto: "Mas Deus prova o seu amor para conosco, em que Cristo morreu por nós, sendo nós ainda pecadores." },
  { ref: "1 João 4:8", texto: "Aquele que não ama não conhece a Deus; porque Deus é amor." },
  { ref: "Filipenses 4:6", texto: "Não estejais inquietos por coisa alguma; antes, as vossas petições sejam em tudo conhecidas diante de Deus, pela oração e súplicas, com ação de graças." },
  { ref: "Salmos 121:1-2", texto: "Elevo os meus olhos para os montes; de onde virá o meu socorro? O meu socorro vem do Senhor, que fez o céu e a terra." },
  { ref: "2 Coríntios 5:17", texto: "Assim que, se alguém está em Cristo, nova criatura é; as coisas velhas já passaram; eis que tudo se fez novo." },
  { ref: "Lamentações 3:22-23", texto: "As misericórdias do Senhor são a causa de não sermos consumidos, porque as suas misericórdias não têm fim. Novas são cada manhã; grande é a tua fidelidade." },
  { ref: "Mateus 5:14", texto: "Vós sois a luz do mundo; não se pode esconder uma cidade edificada sobre um monte." },
  { ref: "Êxodo 14:14", texto: "O Senhor pelejará por vós, e vos calareis." },
  { ref: "Salmos 139:14", texto: "Eu te louvarei, porque de um modo assombroso, e tão maravilhoso fui feito; maravilhosas são as tuas obras, e a minha alma o sabe muito bem." },
  { ref: "Romanos 12:2", texto: "E não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento, para que experimenteis qual seja a boa, agradável e perfeita vontade de Deus." },
  { ref: "Hebreus 13:8", texto: "Jesus Cristo é o mesmo, ontem, e hoje, e eternamente." },
  { ref: "Provérbios 15:1", texto: "A resposta branda desvia o furor, mas a palavra dura suscita a ira." },
  { ref: "Salmos 100:4", texto: "Entrai pelas suas portas com ações de graças, e em seus átrios com louvor; louvai-o, e bendizei o seu nome." },
  { ref: "Apocalipse 3:20", texto: "Eis que estou à porta e bato; se alguém ouvir a minha voz, e abrir a porta, entrarei em sua casa, e com ele cearei, e ele comigo." },
] as const;

/**
 * Sorteia um versiculo.
 *
 * Importante: NAO chame isto durante o render do servidor e do cliente com
 * resultados diferentes, senao o React acusa hydration mismatch. O componente
 * `VerseOfTheDay` resolve isso sorteando dentro de um efeito, ja no cliente.
 */
export function versiculoAleatorio(anterior?: string): Versiculo {
  const pool =
    anterior && VERSICULOS.length > 1
      ? VERSICULOS.filter((v) => v.ref !== anterior)
      : VERSICULOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

