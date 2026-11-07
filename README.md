# Portefeuille

Tableau de bord d'un compte DEGIRO, en une seule page web, sans serveur et sans bibliothèque.

- **Valeur nette, liquidités, plus-values** : lues sur la capture que la macro MacroDroid « DEGIRO -> Portefeuille »
  dépose dans le presse-papier du téléphone, puis ouvre cette page (`?capture=…`).
- **Diagrammes** : évolution de la valeur au fil des captures, répartition par ligne, plus-values latentes par ligne.
- **XIRR** (rendement annuel de l'argent versé) et bilan du compte (dividendes, impôts, frais, change) : à partir du
  relevé de compte DEGIRO exporté en CSV. Le XIRR n'utilise que des euros : versements, retraits et valeur du compte.

Toutes les données restent dans le navigateur de l'appareil (`localStorage`) : rien n'est envoyé nulle part.
Ce dépôt est public : il ne contient **aucune** donnée de portefeuille, et n'en contiendra jamais (voir `.gitignore`).

## Contrôles

```
node outillage/tester.js                 # jeux d'essai fictifs
node outillage/tester.js capture.txt …   # + lecture de captures ou de relevés réels (montants masqués)
```
