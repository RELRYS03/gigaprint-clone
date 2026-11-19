# Integração do Expressarte Grid no GigaPrint Clone

## Origem

Repositório privado `RELRYS03/expressarte-grid`, branch `main`, snapshot `a5ed044ef6b6ba1915420a6524cab8338e01a68d` (19/11/2026). A árvore original tem 283 arquivos e cerca de 17,9 MB: 111 páginas HTML, 90 módulos JS em `public/js`, dados JSON, imagens, fontes, modelos e distribuição estática.

## Integração nesta branch

- 90 módulos JavaScript copiados para `public/reference/js/`.
- Shell de entrada copiado para `public/reference/index.html`.
- Traduções pt-BR e espanhol copiadas para `public/reference/i18n/`.
- Avisos de terceiros preservados em `reference/THIRD_PARTY_NOTICES.txt`.
- Caminhos de scripts e traduções ajustados para a área `/reference`.
- Fontes e runtime Manifold (JavaScript/WebAssembly) copiados para `/reference/fonts/` e `/reference/assets/`.
- Imagens, vídeos e modelos binários de demonstração continuam servidos pelo host público `gigaprint.app`.
- A área de referência foi reidentificada visualmente como GigaPrint e os links sociais foram ocultados.
- A homepage ganhou o link **Full workbench**; os cartões com rotas confirmadas abrem os editores correspondentes.

## Acesso direto

- Workbench completo: `/reference/index.html?lang=pt`
- Organizador de gavetas: `/reference/index.html?embed=1&lang=pt#drawer` (o identificador após `#` abre o editor automaticamente)
- Giant print: `/reference/index.html?embed=1&lang=pt#split`
- Drawer mat: `/reference/index.html?embed=1&lang=pt#drawermat`
- Pots and pans: `/reference/index.html?embed=1&lang=pt#potsdrawer`

## Identificadores confirmados

52 valores `data-go` foram encontrados no HTML original: drawer, split, frame, ornament, phonecase, box, drawermat, potsdrawer, toolorg, wallplate, fridge, c7bulb, lampshade, lightbox, objlitho, litho, shadowlamp, barmat, coaster, mc, bubble, gridbin, suspend, mold, relief, shape, laser, fx, hollow, combine, puzzle, separate, repair, rims, necklace, qrtags, sign, keytags, heartpuzzle, flexname, paint, plateframe, hexwall, geowall, vase, plantpot, stamp, clicker, lightercase, robotarm, pelicancase e cig.

## Código de gavetas encontrado

- `homeorg.8da1446cb3.js`: layout em árvore/células, presets, redimensionamento, merge com validação retangular, split, geração de peças, 42 mm grid.
- `app.6721f601b6.js`: interface, seleção, controles, histórico undo/redo, autosave, projetos JSON e exportação.
- `core.dc3223394b.js`: parse/write STL, cortes e junções de malha.
- `tools.641bcfddbc.js`: extrusão geométrica, 3MF e ZIP.
- `plates.d6dcdeedc4.js`: planejamento de peças por mesa, encaixes dovetail e build plates.
- `drawerprops`, `drawerup`, `drawerx`, `inserts`, `fitlib`, `estimate`, `formats`: módulos de componentes, upgrades, objetos e formatos.

## Limitações e validação

- Esta branch integra o workbench original como referência executável; os editores ainda não foram convertidos em componentes React separados.
- Imagens, vídeos e modelos de demonstração continuam dependendo do domínio público de origem; a área não é uma cópia offline integral.
- O repositório de origem não possui pasta de testes nem workflow de build.
- O build Vite do clone valida a inclusão da aplicação estática, mas não comprova todos os fluxos 3D, a integridade das exportações ou a execução em navegador. Esses testes ainda serão feitos.
