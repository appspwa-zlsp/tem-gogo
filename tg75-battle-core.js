/* Tem Gogó V7.5 — regras de apresentação/QA. A autoridade é SEMPRE o PostgreSQL.
 * Algoritmo de chave espelha o SQL10; pontuação não substitui o resultado confirmado.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.defineProperty(root, 'TGBattleCore', { value: Object.freeze(api), configurable: false });
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const arrangements = {
    2: [1, 2], 4: [1, 4, 2, 3],
    8: [1, 8, 4, 5, 2, 7, 3, 6],
    16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
  };
  function integer(n, min, max, label) {
    if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(label || 'Valor fora do intervalo');
    return n;
  }
  function shape(n) {
    integer(n, 2, 12, 'São necessários de 2 a 12 competidores');
    const base = n < 4 ? 2 : n < 8 ? 4 : 8;
    const prelim = n - base;
    return Object.freeze({competitors:n, post_prelim_size:base, preliminary_duels:prelim,
      byes:prelim ? base-prelim : 0, elimination_duels:n-1,
      bronze_policy:n<4?'none':n<=7?'bronze_duel':'shared_bronze',
      minimum_playlist_songs:n-1+(n>=4&&n<=7?1:0),reserve_song_recommended:true});
  }
  function layout(n) {
    shape(n);
    const size = n<=2?2:n<=4?4:n<=8?8:16;
    const bronze = n>=4 && n<=7;
    const rounds = Math.log2(size);
    let sources = arrangements[size].map(seed => seed<=n?{kind:'seed',seed_no:seed}:null);
    const fixtures=[], byes=[];
    for (let round=1;round<=rounds;round++) {
      const next=[];
      for (let i=0;i<sources.length;i+=2) {
        const left=sources[i], right=sources[i+1], pair=i/2+1;
        if (!left && !right) throw new Error('Árvore inválida: dois BYEs no mesmo nó');
        if (!left || !right) {
          if (round!==1) throw new Error('BYE fora da primeira rodada');
          const carry=left||right;
          byes.push({round,pair,seed_no:carry.seed_no,reason:'empty_seed_slot'});
          next.push(carry);
        } else {
          const key=`R${round}M${pair}`;
          fixtures.push({key,round,pair,kind:round===rounds?'final':'elimination',
            stage_order:round===rounds?rounds+(bronze?2:1):round+1,left,right});
          next.push({kind:'winner',fixture:key});
        }
      }
      sources=next;
    }
    if (fixtures.length!==n-1 || byes.length!==size-n) throw new Error('Contagem inconsistente de chaves');
    if (bronze) fixtures.push({key:'B1',round:rounds,pair:1,kind:'bronze',stage_order:rounds+1,
      left:{kind:'loser',fixture:`R${rounds-1}M1`},right:{kind:'loser',fixture:`R${rounds-1}M2`}});
    return {layout_version:'seeded_tree_v1',competitors:n,bracket_size:size,rounds,
      bronze_policy:n<4?'none':bronze?'bronze_duel':'shared_bronze',
      elimination_duels:n-1,bronze_duels:bronze?1:0,byes,fixtures};
  }
  function divaStars(score) {
    if(!Number.isInteger(score)||score<0||score>100)return null;
    return score>=80?5:Math.floor(score/20)+1;
  }
  function qualifier({technicalScore,humanStars=[]}) {
    const diva=divaStars(technicalScore);
    if(diva===null) throw new Error('Nota técnica ausente ou inválida');
    humanStars.forEach(star=>integer(star,1,5,'Estrelas inválidas'));
    const numerator=2*(humanStars.reduce((a,b)=>a+b,0)+diva);
    const denominator=humanStars.length+1;
    return {diva_stars:diva, human_ballots:humanStars.length,
      points_numerator:numerator,points_denominator:denominator,
      average_2_to_10:Math.round((numerator/denominator)*10000)/10000};
  }
  function duel({singerIds,ballots,technicalA,technicalB}) {
    if(!Array.isArray(singerIds)||singerIds.length!==2||singerIds[0]===singerIds[1]) throw new Error('Duelistas inválidos');
    integer(technicalA,0,100,'Nota técnica A inválida');integer(technicalB,0,100,'Nota técnica B inválida');
    const seen=new Set(), sums=[0,0], singers=new Set();let external=0;
    for(const b of ballots) {
      if(!b || typeof b.voterId!=='string' || !b.voterId || seen.has(b.voterId))throw new Error('Voto sem identidade ou duplicado');
      seen.add(b.voterId);integer(b.starsA,1,5,'Voto A inválido');integer(b.starsB,1,5,'Voto B inválido');
      sums[0]+=b.starsA;sums[1]+=b.starsB;
      if(singerIds.includes(b.voterId))singers.add(b.voterId);else external++;
    }
    const quorum=singers.size===2 && external>=2 && ballots.length>=4;
    let winner=null,method=quorum?'popular':'insufficient_popular_quorum';
    if(quorum&&sums[0]!==sums[1])winner=sums[0]>sums[1]?'A':'B';
    if(!winner){
      if(quorum)method='popular_tie_technical_tiebreak';
      if(technicalA!==technicalB)winner=technicalA>technicalB?'A':'B';
      else method='absolute_tie_needs_rematch';
    }
    return {winner,method,quorum,singers_voted:singers.size,external_voted:external,
      human_ballots:ballots.length,stars_a_sum:sums[0],stars_b_sum:sums[1],
      requires_server_confirmation:true};
  }
  // D-01: primeira igualdade absoluta -> revanche com outra música;
  // igualdade absoluta na revanche -> vantagem da melhor semente já homologada.
  // Requer DUAS tentativas reais confirmadas no servidor; nunca gerar resultado aqui.
  function absoluteTieDecision({attempt,seedA,seedB,previousAbsoluteTie=false}) {
    integer(attempt,1,2,'Tentativa inválida');
    if(attempt===1)return {decision:'rematch_required',winner:null};
    if(!previousAbsoluteTie)return {decision:'previous_tie_not_verified',winner:null};
    integer(seedA,1,12,'Semente A inválida');integer(seedB,1,12,'Semente B inválida');
    if(seedA===seedB)return {decision:'invalid_seed_order',winner:null};
    return {decision:'seed_advantage_after_rematch',winner:seedA<seedB?'A':'B'};
  }
  function resolveFixture(fixture,seeds,results) {
    function resolve(source){
      if(source.kind==='seed')return seeds[source.seed_no]||null;
      const match=results[source.fixture];
      if(!match?.winner || !match?.loser)return null;
      return source.kind==='winner'?match.winner:match.loser;
    }
    const a=resolve(fixture.left),b=resolve(fixture.right);
    return {a,b,ready:Boolean(a&&b&&a!==b)};
  }
  return {shape,layout,divaStars,qualifier,duel,absoluteTieDecision,resolveFixture};
});
