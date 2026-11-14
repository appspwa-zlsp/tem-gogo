TEM GOGÓ 9.0 — ATUALIZAÇÃO DA VERSÃO 8

QR direto e sem senha da festa; backend RLS continua protegendo filas e
microfones por membresia. Códigos novos: 12 dígitos hexadecimais; antigos: 8.

A busca consulta primeiro o histórico de vídeos que passaram de 50% de
reprodução efetiva. Se o usuário optar pela busca externa, a Edge Function
youtube-search usa SerpApi, só para membros/hosts autenticados. Em caso de
cota atingida ou saldo não verificável, bloqueia a busca externa e sugere
escolher uma música do acervo ou inserir um URL YouTube manual.

ORDEM: MIGRACAO_009...sql > DEPLOY youtube-search.ts > GITHUB raiz.
Nunca colocar SERPAPI_KEY nos arquivos públicos. Leia COMECE_AQUI_V9.txt.
