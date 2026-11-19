# GigaPrint Clone

Reconstrução independente do site https://gigaprint.app/, usando o site original como fonte de verdade.

## Regras do projeto

- Reproduzir somente páginas, ferramentas, textos, estilos e interações confirmados no GigaPrint.
- Não criar páginas placeholder, ferramentas inventadas ou botões sem comportamento real.
- Manter a experiência original em inglês, salvo se o próprio site oferecer outro idioma.
- Processar arquivos localmente no navegador sempre que esse for o comportamento do original; não enviar modelos ou fotos para um servidor.
- Implementar por etapas pequenas e registrar o que foi realmente validado.
- Comparar desktop, tablet e celular; nunca declarar fidelidade total sem evidência.

## Fonte de referência

- Site: https://gigaprint.app/
- REA (ferramenta auxiliar de engenharia reversa, não código-fonte do GigaPrint): https://github.com/morluto/rea

## Estado atual — 18/11/2026

- Repositório independente criado: https://github.com/RELRYS03/gigaprint-clone
- Aplicação inicial criada com React e Vite.
- Homepage inicial contém cabeçalho, hero, ilustração CSS, busca local em uma amostra de ferramentas, seção de benefícios, aviso de privacidade e rodapé.
- Layout responsivo inicial incluído em `src/styles.css`.
- GitHub Actions configurado para executar `npm install` e `npm run build`.
- A implementação atual é um protótipo de estrutura visual, não uma réplica fiel validada.
- Os cartões de ferramentas ainda encaminham para o site original; as ferramentas não foram reconstruídas.
- Não há confirmação registrada de build bem-sucedido nem comparação visual final com o original.

## Atualização de implementação — 19/11/2026

Branch de trabalho: `feature/giant-print-functional-scale` (a branch `main` permanece sem alterações).

- O controle **Scale (%)** agora aplica escala uniforme ao modelo carregado na prévia 3D.
- As dimensões X, Y e Z exibidas acompanham o percentual aplicado.
- Os controles Mirror X / Mirror Y mantêm o espelhamento ao alterar a escala.
- O botão Reset da visualização volta a escala para 100% e remove os espelhamentos.
- A escala atua na prévia local; ainda não existe exportação do modelo redimensionado.
- A divisão geométrica, geração de juntas e exportações continuam pendentes.
- Esta alteração foi conferida no arquivo do repositório, mas ainda não foi executada em navegador nem validada por build nesta etapa.

## Auditoria e reconstrução — etapa 1

Inspeção direta do conteúdo público do site em 18/11/2026:
- A homepage apresenta “GigaPrint: make print-ready STL files in seconds”, resumo do workbench, confiança sobre arquivos locais, “Popular generators”, “All tools”, pricing, perguntas frequentes e comunidade.
- A navegação inclui coleções de ferramentas, calculadoras, guias, páginas institucionais e suporte.
- Captura textual/HTML e lista de links foram obtidas para a homepage; também foram inspecionadas as páginas públicas de Giant print, Home organization, Calculators e Guides.
- A página Giant print confirma importação STL/OBJ/3MF, presets de mais de 50 impressoras, cortes automáticos/personalizados/radiais, juntas e exportação STL/3MF/PDF, com limites Free/Pro.
- A coleção Home organization confirma drawer bins, fitted mat, tool organizer, wall plates, pots and pans e refrigerator organizer.
- O site anuncia tratamento local no navegador; não reproduzir processamento remoto nem simular exportações que não existam.

### Uso do REA
O README oficial de `morluto/rea` descreve uma ferramenta de engenharia reversa com inspeção de websites em navegador, estrutura de páginas, scripts, observações de rede e screenshots solicitados. REA é ferramenta auxiliar de observação; não é o código-fonte do GigaPrint. Sua análise local e fluxo MCP exigem instalação/configuração no ambiente do usuário com Node.js e navegador Chromium compatível. Nenhum resultado de execução local do REA foi alegado nesta etapa.

### Implementação da etapa 1
- Atualizada a homepage com o título e conteúdo textual observados no original.
- Adicionadas seções de geradores populares, categorias, pricing, FAQ, comunidade e privacidade.
- Imagens dos cartões populares referenciam ativos públicos de ferramentas observadas no próprio domínio GigaPrint.
- O catálogo permanece uma amostra explicitamente identificada, não uma lista completa.
- Ferramentas continuam apontando para as rotas originais; não foram inventadas interfaces de ferramenta nem exportações falsas.
- Incluída busca e filtro local por categorias na amostra implementada.
- CSS responsivo preparado para desktop, tablet e mobile, mas ainda sem comparação por screenshots em três breakpoints.

### Verificação
- GitHub Actions Build acionado pelos commits da etapa 1; no instante da consulta estava em execução (Node setup em andamento). Aguardar conclusão antes de declarar build aprovado.
- Pontuação visual: **não medida**. Não há screenshots pareadas do original e clone em desktop/tablet/mobile nesta etapa.
- Funcionalidades de ferramentas: **não medidas**; ainda não implementadas localmente.
- Fidelidade global: **não pontuada**; homepage foi aproximada usando estrutura/textos extraídos, sem validação visual quantitativa.

## Auditoria detalhada — Giant print / STL splitter (18/11/2026)

A interface foi aberta em navegador real e inspecionada sem enviar arquivos, iniciar exportações ou autenticar.

### Estrutura observada
- Cabeçalho com logo GigaPrint, links sociais, Open the app, Home, All tools, Suggest a generator, seletor English e acesso Sign in · 2 free · no card.
- Título: “Free online STL splitter for 3D printing”.
- Descrição confirma suporte a STL, OBJ e 3MF e processamento local.
- Amostra inicial: `giant-robot.stl`, dimensões 1038.3 × 648.7 × 1828.8 mm, 138 partes.
- Legenda de cama de impressão (verde/vermelho), área de exclusão Bambu e referências de escala.
- Visões: 3D, Front, Top, Side, Wire, Fit e Build volume.
- Ferramentas da visualização: Explode, Assemble, IDs, Bed check, Infill, Joint check, Scale ref e Reset view.
- Controles de modelo: Open model, Sample model, rotações X/Y/Z, Mirror, Lay flat e Undo.
- Dimensões finais X/Y/Z, Scale %, seleção de impressora, dimensões customizadas, margem de segurança, orientação e cama redonda.
- Cortes: Count com modo smart (“Follow the shape”).
- Juntas: Pegs, Dowel pins, Snap clips, Dovetail slide, Magnets, Step lip e Flat. Clearance padrão observado: 0.2 mm.
- Preparação: marcar IDs, hollow before splitting e orientar cada parte para melhor face.
- Ações: Split model, Download your parts (ZIP) e 3MF plates.

### Regras funcionais confirmadas pela página
- O modo gratuito permite até 4 peças com pegs ou faces planas e joint fit check.
- Mais peças, outros tipos de junta, planos de corte personalizados, cunhas radiais, costuras alternadas, várias impressoras, hollowing e saída 3MF são Pro.
- Exportações descritas: STL, multi-object 3MF, 3MF build plates e PDF de montagem.
- A página declara que o modelo é processado no navegador e não enviado ao servidor.
- A verificação de encaixe identifica furos incompatíveis, folgas e paredes finas.

### Estado de implementação
A interface e o motor geométrico desta ferramenta **ainda não foram implementados** no clone. Esta auditoria registra o comportamento real para orientar a próxima etapa; não transforma os controles em elementos decorativos nem declara exportação funcional.

### Build
GitHub Actions Build dos commits de homepage e documentação concluído com **success**. Isso valida compilação Vite/React, não fidelidade visual nem funcionalidades 3D.

## Auditoria inicial da página inicial

A inspeção textual inicial identificou o GigaPrint como um workbench 3D que roda no navegador, com arquivos permanecendo no dispositivo. A página anuncia importação de STL, OBJ e 3MF; exportação de STL, 3MF, SVG e PDF conforme a ferramenta; prévias gratuitas; e estimativas de filamento, custo e tempo.

Os links de ferramentas, calculadoras, guias e páginas institucionais foram identificados na navegação. A presença de um link não comprova que a rota ou sua funcionalidade tenha sido auditada. Cada rota deverá ser aberta e verificada individualmente antes de ser implementada.

## Próximas etapas

1. Comparar a homepage atual com a referência original e corrigir diferenças visuais estruturais.
2. Inventariar e priorizar as rotas reais do site original.
3. Inspecionar cada ferramenta antes de reproduzir sua interface e comportamento.
4. Implementar as ferramentas uma por uma, incluindo entradas, visualização e exportação quando confirmadas.
5. Validar desktop, tablet e celular e registrar evidências.
6. Executar build e testes automatizados após mudanças relevantes.

## Como executar localmente

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

O projeto é independente e não é afiliado ao GigaPrint.
