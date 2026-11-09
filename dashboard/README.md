# Dashboard de programação de entregas — Omnia

Site estático. Os carros das abas Nacional e Importado ficam em `data.js`.

Para ver nesta pasta:

```bash
python3 -m http.server 8080
```

Abra http://127.0.0.1:8080

## Atualização

A Vertiv não autorizou a leitura direta do SharePoint. Quando chegar uma planilha nova, rode:

```bash
python3 dashboard/atualizar.py caminho/da/planilha.xlsx
```

O comando relê as abas Nacional e Importado e só grava `data.js` se os carros mudaram. A planilha completa não entra no site. Entram data, origem, transportadora, ordem de frete, material e se já houve baixa DRM.
