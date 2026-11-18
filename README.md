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
