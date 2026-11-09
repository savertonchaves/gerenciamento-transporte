# Dashboard de programação de entregas — Omnia

Site estático. Os carros das abas Nacional e Importado ficam em `data.js`.

Para ver nesta pasta:

```bash
python3 -m http.server 8080
```

Abra http://127.0.0.1:8080

## Atualização automática

O painel relê a planilha do SharePoint sozinho, de hora em hora, nos dias úteis, das 8h às 18h (horário de São Paulo). Se a transportadora ou a programação mudou, o site é publicado de novo. Se nada mudou, ele não mexe no site.

A planilha em si não vai para o site nem para o repositório. Entram só data, origem, transportadora, ordem de frete, material e se já houve baixa DRM.

Falta uma autorização, uma vez. O SharePoint da Vertiv não entrega o arquivo sem o login da empresa. Depois dessa autorização, ninguém precisa voltar aqui para atualizar.
