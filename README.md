# Portefeuille

Tableau de bord d'un compte DEGIRO, en une seule page web, sans serveur et sans bibliothèque.

- **Valeur nette, liquidités, plus-values** : lues sur la capture que la macro MacroDroid « DEGIRO -> Portefeuille »
  dépose dans le presse-papier du téléphone, puis ouvre cette page (`?capture=…`).
- **Diagrammes** : évolution de la valeur au fil des captures, répartition par ligne, plus-values latentes par ligne.
- **XIRR** (rendement annuel de l'argent versé) et bilan du compte (dividendes, impôts, frais, change) : à partir du
  relevé de compte DEGIRO exporté en CSV. Le XIRR n'utilise que des euros : versements, retraits et valeur du compte.

Toutes les données restent dans le navigateur de l'appareil (`localStorage`) : rien n'est envoyé nulle part.
Ce dépôt est public : il ne contient **aucune** donnée de portefeuille, et n'en contiendra jamais (voir `.gitignore`).

## Ajouter un indicateur

Les indicateurs vivent dans `indicateurs.js`, une fiche par indicateur (calcul, seuils, explication) : le mode
d'emploi est en tête du fichier. Ajouter une fiche suffit — ni la macro ni le reste de la page ne changent. Lancer
ensuite `node outillage/tester.js` : chaque fiche y est exécutée sur un portefeuille fictif, avec et sans relevé ni cours.

## Cours et analyse

- **Cours** : lus dans le dépôt privé `portefeuille-cours` (robot quotidien), avec une clé d'accès GitHub
  limitée à ce dépôt, enregistrée dans le navigateur seulement.
- **Analyse par Claude** : SDK officiel `@anthropic-ai/sdk` chargé à la demande, avec la clé API de Vigie
  (même origine `olivieroliv.github.io`, donc même stockage). Coût estimé affiché avant chaque envoi.

## Contrôles

```
node outillage/tester.js                 # jeux d'essai fictifs
node outillage/tester.js capture.txt …   # + lecture de captures ou de relevés réels (montants masqués)
```
