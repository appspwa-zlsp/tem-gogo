/**
 * Conexão pública preenchida para o projeto Tem Gogó. Hospede somente em HTTPS.
 * Use somente a chave publicável/anon do Supabase. NUNCA use service_role ou secret aqui!
 * Projeto: tem-gogo (hfyeucscipknhkfwfyto). Dados públicos fornecidos pelo proprietário.
 * A estrutura do banco deve estar previamente instalada (V13); veja o SQL_014 se ainda nao foi aplicado.
 */
window.TEM_GOGO_CONFIG = {
  SUPABASE_URL: 'https://hfyeucscipknhkfwfyto.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_q92OfV3oxYJHhxqf-qWK2g_tMjjxQrl',
  // A busca de vídeos funciona via Edge Function "youtube-search" no Supabase.
  // A chave da SerpApi fica SOMENTE nos Secrets da Edge Function (SERPAPI_KEY).
  // Não coloque aqui a chave SerpApi nem em outros arquivos públicos do GitHub.
  // OPCIONAL: API pública GIPHY para um GIF de reação por música finalizada.
  // Chave beta: até 100 chamadas/hora (confirmar limite atual no GIPHY).
  // Publicado no front-end = visível aos visitantes. Restrinja e monitore pelo painel do GIPHY.
  // Sem a chave, memes e comentários locais continuam funcionando normalmente.
  GIPHY_API_KEY: '',
  // STUN ajuda a descobrir conexões, mas nem sempre atravessa NAT/operadoras.
  // Para uso fora da mesma rede Wi-Fi, cadastre um TURN confiável em produção.
  ICE_SERVERS: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
    // ,{ urls: 'turn:seu-turn.com:3478', username: 'usuario', credential: 'senha' }
  ],
  // Configure a chave PÚBLICA VAPID somente após implantar a Edge Function karaoke-push.
  // Nunca coloque a chave PRIVADA no GitHub.
  VAPID_PUBLIC_KEY: '',
  // V7.5: não ativar enquanto API, notas, recuperação e QA não forem homologados.
  BATTLE_API_RELEASE_ALLOWED: true,
  // R108: somente sala piloto expressamente autorizada no Supabase. Não ativar em produção.
  HOST_LEASE_PILOT: false,
  MAX_ACTIVE_MICS: 8
};
