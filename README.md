# s2-market

**Abrir o app: https://rh-albergoni.github.io/s2-market/**

Lista do mercado do mês (3 pessoas, 4 idas por mês). É uma página única (`index.html`), hospedada no GitHub Pages, que salva os dados numa planilha do Google via Apps Script.

## 1. Planilha + Apps Script (os dados)

1. Crie uma planilha nova no Google Sheets (ex.: "Mercado do mês").
2. Abra **Extensões → Apps Script**, apague o conteúdo e cole o arquivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Salve.
3. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Autorize o acesso quando o Google pedir (pode aparecer "app não verificado" → *Avançado → Acessar*).
5. Copie a **URL do app da Web**, que termina em `/exec`.

Os dados ficam em JSON na célula `A1` da aba `dados`.

> Se mudar o `Codigo.gs` depois, use **Implantar → Gerenciar implantações → editar → Nova versão** para manter a mesma URL.

## 2. GitHub Pages (o site)

Todo push na `master` publica o site automaticamente pelo workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml). O Pages já está configurado com a origem **GitHub Actions**. O site fica em https://rh-albergoni.github.io/s2-market/.

## 3. Conectar o app à planilha

Abra o site uma vez com a URL do Apps Script no parâmetro `api`:

```
https://rh-albergoni.github.io/s2-market/?api=https://script.google.com/macros/s/XXXX/exec
```

O app guarda a URL no celular e tira o parâmetro da barra de endereço. Mande esse link para as outras pessoas. Também dá para colar a URL em **configurar**, no rodapé do app.

A URL do Apps Script não fica no código, porque quem tiver essa URL consegue ler e alterar a lista. Por isso, não publique a URL em lugar nenhum.

## Como funciona a sincronização

- Cada toque vira uma operação pequena (marcar item, valor pago etc.). Ela é aplicada na hora e enviada para a planilha, então duas pessoas marcando itens ao mesmo tempo não apagam uma à outra.
- Sem internet, as alterações ficam numa fila no celular e sobem quando a conexão voltar.
- O app busca as novidades da planilha a cada 15 s e quando volta a ficar visível na tela.

## Editar a lista de itens

Os itens, as quantidades e os valores previstos de cada ida estão nas constantes `SEMANA`, `ACOUGUE` e `IDAS`, no começo do `<script>` em `index.html`.
