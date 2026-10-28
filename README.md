# s2-market

**Abrir o app: https://rh-albergoni.github.io/s2-market/**

App da lista do mercado do mês: 4 idas ao mercado por mês, pensado para usar no celular **dentro do mercado**, com duas pessoas marcando a mesma lista ao mesmo tempo. Tudo fica salvo no **Google Planilhas**.

## O que dá para fazer

- **Compras:** o mês, com o gasto até agora comparado ao previsto, e as 4 idas (dias 1, 8, 15 e 22). Mostra o que já foi pego, quanto foi pago em cada ida e quem está usando o app agora.
- **Modo mercado** (ao tocar numa ida):
  - Toque no item quando colocar no carrinho. O item some da lista "Faltam" depois de um instante, e o toast tem a opção **Desfazer**.
  - O botão **⋯** abre outras opções: **Tenho em casa**, **Não achei** e **Desmarcar**.
  - Os filtros **Faltam**, **Carrinho** e **Todos** mostram a lista por seção (Açougue, Hortifrúti...). A **lupa** busca um item pelo nome, sem precisar de acento.
  - **Adicionar item fora da lista** inclui um item só naquela compra.
  - Quando a outra pessoa marca um item, ele aparece marcado no seu celular em poucos segundos, com o nome de quem pegou. O topo mostra quem mais está na mesma lista.
  - **Finalizar compra:** mostra o resumo, deixa levar o que ficou de fora para a próxima ida e pede o valor que deu no caixa, comparando com o previsto.
  - A tela não apaga enquanto a lista está aberta.
- **Histórico:**
  - Gráfico de gasto x previsto mês a mês.
  - Média dos últimos meses.
  - Sugestão de novo valor previsto para cada ida, com base no que vocês realmente gastaram, aplicável com um toque.
  - Tabela com todos os meses.
- **Ajustes:**
  - **Número de pessoas:** as quantidades da lista se ajustam sozinhas, e dá para ajustar os valores previstos na mesma proporção.
  - **Idas:** dia, nome e valor previsto de cada uma.
  - **Lista de compras:** criar, editar e excluir itens, escolhendo em quais idas cada um entra e quanto.
  - **Seu nome:** o nome que aparece para a outra pessoa.
  - **Planilha conectada**, com o botão **Convidar outra pessoa**, que manda um link que já conecta o celular dela.
- **Funciona sem sinal:** as marcações ficam guardadas no aparelho e sobem sozinhas quando a conexão volta. O app abre mesmo offline e pode ser instalado na tela inicial (no navegador, use **Adicionar à tela inicial**).
- Cada mês guarda o número de pessoas e os valores previstos da época. Mudanças nos Ajustes valem do mês atual em diante.

## 1. Planilha + Apps Script (onde os dados ficam)

1. Crie uma planilha no Google Sheets.
2. Abra **Extensões → Apps Script**, apague o conteúdo e cole o arquivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Salve.
3. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Autorize o acesso. Se aparecer "O Google não verificou este app", clique em **Avançado → Acessar**.
5. Copie a **URL do app da Web**, que termina em `/exec`.

### Atualizar o script (quando o `Codigo.gs` mudar)

Cole o código novo e vá em **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar**. Assim a URL continua a mesma.

Enquanto o script não for atualizado, o app avisa com a mensagem **"Atualize o script"** e guarda as marcações no aparelho, sem mandar nada para a planilha. Assim que a versão nova é publicada, tudo sobe sozinho e os dados das versões anteriores são convertidos automaticamente.

### O que fica na planilha

- Aba **`dados`**: uma linha `config` (pessoas, idas e lista de itens) e uma linha por mês (`mes:2026-10`). A coluna A tem a chave e a coluna B, o JSON. É melhor não editar essa aba na mão.
- Aba **`resumo`**: tabela gerada automaticamente com mês, pessoas, previsto, gasto, diferença e o valor de cada ida. É só para consulta e é refeita a cada alteração.

## 2. Site (GitHub Pages)

Todo push na `master` publica o site automaticamente pelo workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml). O site fica em https://rh-albergoni.github.io/s2-market/.

## 3. Conectar cada celular

Abra uma vez o link com a URL do Apps Script:

```
https://rh-albergoni.github.io/s2-market/?api=https://script.google.com/macros/s/XXXX/exec
```

O app guarda a URL no aparelho e tira o parâmetro da barra de endereço. Também dá para colar a URL em **Ajustes → Google Planilhas**. Na primeira vez que abrir uma ida, o app pergunta o seu nome, que é o que aparece para a outra pessoa.

Quem tiver a URL do Apps Script consegue ler e alterar a lista. Por isso ela não fica no código, e não deve ser publicada em lugar nenhum.

## Como funciona a sincronização

- Cada toque vira uma operação pequena, por exemplo "banana do dia 1 = no carrinho, por Ana". Ela vale na hora no aparelho e é enviada logo em seguida. A planilha aplica as operações uma a uma, então duas pessoas marcando itens ao mesmo tempo nunca apagam o trabalho uma da outra.
- A planilha guarda um número de revisão. Com a lista aberta, o app consulta só esse número a cada 3 segundos, o que é rápido, e baixa os dados apenas quando algo mudou. Nas outras telas, a consulta é a cada 12 segundos. Com o app em segundo plano, ele não consulta nada.
- Sem conexão, as alterações ficam numa fila no aparelho, e o indicador no topo mostra quantas estão pendentes.
- Se alguém editar a aba `dados` direto na planilha, o app pega a mudança em até 2 minutos.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Estrutura da página |
| `app.css` | Visual (celular primeiro; tablet e desktop a partir de 700 e 960 px; modo escuro) |
| `app.js` | O app: dados, sincronização e telas |
| `sw.js` | Service worker: deixa o app abrir sem sinal |
| `manifest.webmanifest`, `icon.svg` | Instalação na tela inicial |
| `apps-script/Codigo.gs` | Backend no Google Apps Script |

A lista padrão (planejada para 3 pessoas) está na constante `L0`, no começo de `app.js`. Ela só é usada até a primeira edição pela tela **Ajustes → Lista de compras**. Depois disso, a lista passa a ficar na planilha.

## Testes

```
npm install
npm test
```

Os testes rodam o `Codigo.gs` de verdade sobre uma planilha simulada e abrem o app em vários "celulares" ao mesmo tempo (jsdom). Eles cobrem:

- duas pessoas marcando juntas;
- uso sem sinal e app reaberto offline;
- planilha ainda com o script antigo;
- migração dos dados das versões anteriores;
- histórico, ajustes e editor da lista;
- duas abas no mesmo celular;
- reenvio de operações;
- um teste de estresse com toques aleatórios e rede instável, conferindo que os dois celulares e a planilha terminam idênticos.
