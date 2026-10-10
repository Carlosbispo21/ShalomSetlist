export type UploadStage = 'leitura do PDF' | 'envio do PDF' | 'cadastro do hino';
export function describeUploadError(stage: UploadStage, error: unknown): Error {
  const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const message = typeof fields.message === 'string' ? fields.message : String(error ?? 'Erro desconhecido');
  const status = String(fields.statusCode ?? fields.status ?? fields.code ?? '');
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout/i.test(message)) {
    return new Error(`Falha de conexão durante ${stage}. Não foi possível concluir a comunicação com o servidor. Tente novamente; se persistir, informe esta etapa.`);
  }
  if (/row.level security|permission denied|unauthorized|invalid jwt|jwt expired/i.test(message) || ['401','403','42501'].includes(status)) {
    return new Error(`Sem autorização para ${stage}. Entre novamente com sua conta e confirme a permissão de responsável em Banda.`);
  }
  if (/bucket.*not found/i.test(message)) return new Error('O espaço de PDFs não foi encontrado no servidor. Verifique o bucket scores no Supabase.');
  return new Error(`Falha durante ${stage}: ${message}`);
}
export function isConnectionError(error: unknown) {
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout/i.test(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error));
}
