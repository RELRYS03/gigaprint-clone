# GigaPrint Clone

Reconstrução independente do site https://gigaprint.app/, usando o site original como fonte de verdade.

## Regras do projeto

- Reproduzir somente páginas, ferramentas, textos, estilos e interações confirmados no GigaPrint.
- Não criar páginas placeholder, ferramentas inventadas ou botões sem comportamento real.
- Manter a experiência original em inglês, salvo se o próprio site oferecer outro idioma.
- Processar arquivos localmente no navegador sempre que esse for o comportamento do original; não enviar modelos ou fotos para um servidor.
- Implementar por etapas pequenas, com build e verificações após cada etapa.
- Registrar resultados reais de comparação em desktop, tablet e celular; nunca declarar 100% sem evidência.

## Fonte de referência

- Site: https://gigaprint.app/
- REA (ferramenta auxiliar de engenharia reversa, não código-fonte do GigaPrint): https://github.com/morluto/rea

## Auditoria inicial da página inicial

Inspeção realizada em 2026-11-18. A página descreve o GigaPrint como um workbench 3D que roda no navegador, com arquivos permanecendo no dispositivo do usuário. A página anuncia importação de STL, OBJ e 3MF; exportação de STL, 3MF, SVG e PDF conforme a ferramenta; prévias gratuitas; e estimativas de filamento, custo e tempo.

Links de ferramentas, calculadoras, guias e páginas institucionais foram identificados na navegação da página inicial. Cada rota deverá ser aberta e verificada individualmente antes de ser implementada. A lista de links não é prova de que a funcionalidade de cada rota já foi auditada.

## Etapas

1. Inventariar rotas e capturar referências visuais do site original.
2. Identificar estrutura, tipografia, cores, componentes e comportamento responsivo.
3. Implementar a estrutura compartilhada da página inicial e navegação confirmada.
4. Reproduzir ferramentas individualmente, validando suas entradas, visualização e exportação.
5. Comparar desktop, tablet e celular; corrigir divergências e registrar evidências.
6. Executar build e testes automatizados a cada etapa.

## Estado atual

- Repositório inicializado com este documento.
- Auditoria textual inicial da homepage concluída.
- Implementação da aplicação ainda não iniciada.
- Build e comparação visual ainda não executados.

Não usar este documento como substituto da inspeção individual das rotas e das capturas de referência.
