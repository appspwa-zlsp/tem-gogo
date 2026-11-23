
/*
 * TEM GOGO R91 — Preparacao visual segura.
 * Battle: educativo, sem permitir entrada.
 * Nao altera Supabase, player, QR ou permissoes.
 */
(() => {
  "use strict";

  const styles = `
    #room-hub .tg70-mode-list {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 12px !important;
    }
    #room-hub #tg70-go-classic {
      grid-column: 1 / -1;
      border: 1px solid #e45eb3;
      background: linear-gradient(135deg,#51264f,#292044);
      box-shadow: 0 8px 28px #da51a126;
      min-height: 100px;
    }
    #room-hub #tg70-go-classic strong {
      font-size: 1.2rem;
    }
    #room-hub #tg70-go-battle:disabled {
      opacity: .72;
      cursor: not-allowed;
      filter: saturate(.7);
    }
    #tg91-guide-button {
      grid-column: 1 / -1;
      padding: 13px 16px;
      border: 1px solid #a85c96;
      border-radius: 13px;
      background: #322039;
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    #tg91-guide-button:hover,
    #tg91-guide-button:focus-visible {
      border-color: #f4a5d9;
      background: #483052;
    }
    .tg91-story {
      width: min(560px, calc(100% - 24px));
      max-height: min(90dvh, 760px);
      margin: auto;
      padding: 0;
      border: 1px solid #975a97;
      border-radius: 20px;
      background: #19132a;
      color: #fff;
      box-shadow: 0 20px 75px #0009;
      overflow: auto;
    }
    .tg91-story::backdrop {
      background: #07040dcc;
      backdrop-filter: blur(5px);
    }
    .tg91-story-inner {
      padding: clamp(18px, 4vw, 30px);
      display: grid;
      gap: 15px;
      text-align: center;
    }
    .tg91-story-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .tg91-story-kicker {
      color: #ffbbe7;
      font-weight: 800;
      letter-spacing: .06em;
      font-size: .8rem;
    }
    .tg91-story-close {
      border: 1px solid #806383;
      border-radius: 10px;
      background: transparent;
      color: #fff;
      padding: 8px 12px;
      cursor: pointer;
    }
    .tg91-story-diva {
      width: min(180px, 45%);
      max-height: 170px;
      object-fit: contain;
      margin: 0 auto;
    }
    .tg91-story h2 {
      color: #fff;
      font-size: clamp(1.3rem, 4vw, 1.9rem);
      line-height: 1.2;
      margin: 0;
    }
    .tg91-story p {
      color: #eee0ed;
      line-height: 1.65;
      margin: 0;
    }
    .tg91-story-avatars {
      display: flex;
      justify-content: center;
      gap: 12px;
    }
    .tg91-story-avatars img {
      width: 65px;
      height: 65px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #b779ad;
    }
    .tg91-story-progress {
      color: #dbafd4;
      font-size: .85rem;
    }
    .tg91-story-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .tg91-story-actions button {
      min-height: 44px;
      padding: 10px 15px;
      border: 1px solid #986a98;
      border-radius: 11px;
      background: #3b294b;
      color: #fff;
      font: inherit;
      cursor: pointer;
    }
    .tg91-story-actions button:last-child {
      background: #b83f91;
      border-color: #e778bf;
      font-weight: 800;
    }
    .tg91-story-actions button:disabled {
      opacity: .4;
      cursor: not-allowed;
    }
    .tg91-story-note {
      font-size: .8rem;
      color: #c9bad0 !important;
    }
    .tg91-story :focus-visible,
    #tg91-guide-button:focus-visible {
      outline: 3px solid #ffcf76;
      outline-offset: 3px;
    }
    @media (max-width: 430px) {
      #room-hub .tg70-mode-list {
        grid-template-columns: 1fr !important;
      }
      #room-hub #tg70-go-classic,
      #tg91-guide-button {
        grid-column: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .tg91-story *, #tg91-guide-button {
        animation: none !important;
        transition: none !important;
      }
    }
  `;

  const scenes = [
    {
      title: "Bem-vindos à Batalha!",
      text: "A Drag Diva apresenta o festival: participantes, apresentações, confrontos e um grande pódio. Talento é importante, mas coragem também conta!"
    },
    {
      title: "Vamos montar o elenco!",
      text: "O anfitrião abre as inscrições e aprova de dois a doze competidores. Quem não quiser cantar pode acompanhar a festa. Depois do fechamento, o elenco competitivo não recebe novos integrantes."
    },
    {
      title: "Hora da classificatória!",
      text: "Cada competidor sobe ao palco e recebe suas avaliações. A classificação segue as regras oficiais do festival. A nota técnica não deve ser confundida com uma medição de afinação."
    },
    {
      title: "Começam os confrontos!",
      text: "Os artistas disputam vagas nas próximas fases. O formato da chave depende do número de competidores. Só resultados válidos permitem avançar."
    },
    {
      title: "Todo voto importa!",
      text: "Eleitores habilitados avaliam com uma a cinco estrelas. A janela tem 150 segundos e admite uma única prorrogação de 30 segundos, conforme as regras. O eleitorado é definido na abertura e votos confirmados não podem ser trocados."
    },
    {
      title: "O grande pódio!",
      text: "Ouro, prata e bronze são conquistas persistentes exclusivas da Batalha. Só aparecem quando o resultado oficial permite a premiação. Sem inventar campeões! A Drag Diva encerra o espetáculo."
    }
  ];

  function protect(button, label) {
    if (!button) return;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.title = "Disponível após validação técnica";
    if (label) {
      const small = button.querySelector("small");
      if (small) small.textContent = label;
      else button.textContent = label;
    }
    new MutationObserver(() => {
      if (!button.disabled) button.disabled = true;
    }).observe(button, {
      attributes: true,
      attributeFilter: ["disabled"]
    });
  }

  function init() {
    if (document.getElementById("tg91-guide-button")) return;

    const style = document.createElement("style");
    style.id = "tg91-visual-style";
    style.textContent = styles;
    document.head.append(style);

    const modes = document.querySelector(".tg70-mode-list");
    const classic = document.getElementById("tg70-go-classic");
    const battle = document.getElementById("tg70-go-battle");
    if (!modes || !classic || !battle) return;

    // A mesma estrutura de botao e ID e preservada.
    modes.prepend(classic);
    protect(battle, "Entrada bloqueada • em validação");

    protect(
      document.getElementById("tg75-open-workspace"),
      "Entrar na Batalha — indisponível"
    );

    const intro = document.querySelector(".tg70-modes > p:not(.tg70-kicker)");
    if (intro) {
      intro.textContent =
        "Clássico para cantar com a galera, Solo para seu próprio palco e Batalha para conhecer o festival. A entrada competitiva ainda está em validação.";
    }

    const dialog = document.createElement("dialog");
    dialog.id = "tg91-story";
    dialog.className = "tg91-story";
    dialog.setAttribute("aria-labelledby", "tg91-story-title");
    dialog.innerHTML = `
      <div class="tg91-story-inner">
        <div class="tg91-story-top">
          <span class="tg91-story-kicker">TEM GOGÓ · BATALHA</span>
          <button class="tg91-story-close" type="button" id="tg91-close">Fechar ✕</button>
        </div>
        <img class="tg91-story-diva" src="./diva-busto.png" alt="Drag Diva, mestre de cerimônias">
        <div class="tg91-story-avatars" aria-hidden="true">
          <img src="./cantor-urbano.png" alt="">
          <img src="./cantora-ruiva.png" alt="">
        </div>
        <span class="tg91-story-progress" id="tg91-count"></span>
        <h2 id="tg91-story-title" tabindex="-1"></h2>
        <p id="tg91-story-copy"></p>
        <div class="tg91-story-actions">
          <button type="button" id="tg91-skip">Pular</button>
          <button type="button" id="tg91-prev">Anterior</button>
          <button type="button" id="tg91-next">Próximo →</button>
        </div>
        <p class="tg91-story-note">Apresentação educativa. Não inicia festival, votação nem microfone. Narrações serão integradas após conferência dos arquivos de áudio.</p>
      </div>
    `;
    document.body.append(dialog);

    let index = 0;
    let opener = null;

    const title = dialog.querySelector("#tg91-story-title");
    const copy = dialog.querySelector("#tg91-story-copy");
    const count = dialog.querySelector("#tg91-count");
    const prev = dialog.querySelector("#tg91-prev");
    const next = dialog.querySelector("#tg91-next");

    function render() {
      title.textContent = scenes[index].title;
      copy.textContent = scenes[index].text;
      count.textContent = `Cena ${index + 1} de ${scenes.length}`;
      prev.disabled = index === 0;
      next.textContent =
        index === scenes.length - 1 ? "Concluir" : "Próximo →";
      title.focus({ preventScroll: true });
    }

    function openStory(event) {
      opener = event?.currentTarget || null;
      index = 0;
      render();
      if (!dialog.open) dialog.showModal();
    }

    function closeStory() {
      dialog.close();
    }

    const guide = document.createElement("button");
    guide.id = "tg91-guide-button";
    guide.type = "button";
    guide.textContent = "🎬 Conhecer a Batalha com a Drag Diva";
    guide.addEventListener("click", openStory);
    modes.append(guide);

    dialog.querySelector("#tg91-close")
      .addEventListener("click", closeStory);
    dialog.querySelector("#tg91-skip")
      .addEventListener("click", closeStory);

    prev.addEventListener("click", () => {
      if (index > 0) {
        index--;
        render();
      }
    });

    next.addEventListener("click", () => {
      if (index === scenes.length - 1) {
        closeStory();
      } else {
        index++;
        render();
      }
    });

    dialog.addEventListener("close", () => {
      if (opener?.isConnected) opener.focus();
    });

    // Permite rever a apresentação pela ajuda.
    const faqActions = document.querySelector(
      "#faq-dialog .tg193-faq-actions"
    );
    if (faqActions) {
      const help = document.createElement("button");
      help.className = "button button-outline";
      help.type = "button";
      help.textContent = "🏆 Como funciona a Batalha";
      help.addEventListener("click", openStory);
      faqActions.append(help);
    }

    // Proteção visual adicional contra acionamento acidental.
    document.addEventListener("click", event => {
      if (event.target.closest(
        "#tg70-go-battle, #tg75-open-workspace"
      )) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
