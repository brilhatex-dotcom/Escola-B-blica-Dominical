/**
 * O nome de usuário, escrito de um jeito só.
 *
 * ============================================================================
 * ESTA FUNÇÃO EXISTE PORQUE JÁ FALHOU UMA VEZ
 *
 * A tela de Usuários normalizava o login ao GRAVAR — tirava os espaços e
 * baixava a caixa, para que "Maria Bandeiras" virasse "mariabandeiras". A rota
 * de login procurava a conta pelo texto EXATO que a pessoa digitava.
 *
 * O resultado foi uma conta que se criava com sucesso e não entrava nunca:
 * quem cadastrou "Maria Bandeiras" e digitou "Maria Bandeiras" recebia
 * "Usuário ou senha inválidos", porque no banco estava "mariabandeiras" — e a
 * mensagem, que é propositalmente igual para login inexistente e senha errada,
 * mandava procurar o problema na senha.
 *
 * Duas regras para a mesma coisa, em dois arquivos, sempre acabam divergindo.
 * Aqui é uma só, e os dois lados a chamam.
 * ============================================================================
 */
export function normalizarLogin(bruto: string): string {
  return bruto.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * As formas sob as quais uma conta pode estar gravada, da mais específica para
 * a mais provável.
 *
 * ============================================================================
 * POR QUE NÃO BASTA NORMALIZAR NA ENTRADA
 *
 * Normalizar e procurar só a forma normalizada quebraria as contas herdadas da
 * planilha: uma delas tem o login `Graça`, com maiúscula e cedilha. Baixando a
 * caixa, ela deixaria de ser encontrada — o portal consertaria as contas novas
 * quebrando as antigas, que é exatamente o que a regra da igreja proíbe fazer
 * com registro do sistema antigo.
 *
 * Então a busca tenta primeiro o texto EXATO (é como as contas herdadas estão
 * gravadas) e só depois a forma normalizada (é como as contas novas estão).
 * Quem digita "Maria Bandeiras", "maria bandeiras" ou "mariabandeiras" entra
 * nos três casos, e `Graça` continua entrando como sempre entrou.
 * ============================================================================
 */
export function formasDoLogin(digitado: string): string[] {
  const exato = digitado.trim();
  const normalizado = normalizarLogin(digitado);
  return exato === normalizado ? [exato] : [exato, normalizado];
}
