# Quellen der Produktbilder

Die Produktbilder in `assets/products/` sind lokal gespeicherte Extrakte aus offiziellen LANDI Quellen.

- `100788.png` – LANDI Gartengeräte 2025, Produkt Rasenmäher Akku 18 V Okay
- `70212.png` – LANDI Gartengeräte 2025, Produkt Rasenmäher Akku Okay 2 × 18 V
- `100791.png` – LANDI Gartengeräte 2025, Produkt Rasenmäher Benzin E-Start 6 PS
- `100789.png` – LANDI Gartengeräte 2025, Produkt Rasenmäher Benzin Apollo II 4 PS Okay
- `70203.png` – LANDI Gartengeräte 2025, Produkt Rasenmäher Benzin LuckyPlus 3.5 PS
- `107575.png` – LANDI Produktdruck/PDF, Produkt Rasenmäher Akku 2 × 18 V Pro
- `108065.png` – LANDI Factsheet Rasenmäher Roboter ohne Begrenzungsdraht
- `108769.png` – LANDI Factsheet Rasenmäher Roboter ohne Begrenzungsdraht

Die vollständigen Quell-URLs stehen pro Produkt in `data/products.json` unter `imageSource` und in der Excel-Datei.

## Beispielrezensionen

Die in v5 enthaltenen Rezensionen sind ausschliesslich Demo-Daten für den klickbaren Prototyp. Sie sind keine echten LANDI-Kundenbewertungen. Die Hover-Zusammenfassungen und die Rezensionssektion der PDP basieren inhaltlich auf diesen Demo-Rezensionen.

## KI-Integration v8

Die serverseitige LLM-Integration verwendet die OpenAI Responses API für Produktvergleich, Landingpage-Beratung und Servicechat. Der API-Key wird über die Server-Umgebungsvariable `OPENAI_API_KEY` gelesen und nicht im Frontend gespeichert.
