# Bidule

Des machines en 3D qu'on fait fonctionner pour comprendre comment marchent les choses. Pour les petits, dès la maternelle.

Chaque « monde » est un petit diorama en 3D avec six machines. L'enfant en touche une, une voix lui dit à quoi elle sert, puis il appuie sur le gros bouton et la regarde travailler étape par étape. À chaque étape, la pièce qui bouge s'allume (le vérin, le godet, la charrue…) et la voix explique ce qui se passe.

| Monde | Machines |
| --- | --- |
| **Le Chantier** | pelleteuse, camion-benne, bulldozer, grue à tour, camion toupie, rouleau compresseur |
| **La Ferme** | tracteur + charrue, semoir, pulvérisateur, moissonneuse-batteuse, presse à balles, chariot télescopique |

L'idée de départ vient de [os-taxonomy de Marble](https://github.com/withmarbleapp/os-taxonomy), un graphe des notions du primaire avec leurs prérequis. À terme, chaque monde pourra être rattaché aux notions du programme français (maternelle → lycée).

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173/  (chantier.html, ferme.html)
npm run build    # dist/*.html : un fichier HTML autonome par page
```

`npm run build` produit des fichiers **autonomes** (JS et CSS intégrés) : on peut les ouvrir directement, les héberger n'importe où ou les envoyer tels quels.

Pour tester vite dans un navigateur lent (rendu logiciel, CI), ajoute `?fast` à l'URL : les animations avancent par grands pas.

## Déploiement

Chaque push sur `main` construit l'app et la publie sur **GitHub Pages** (`.github/workflows/pages.yml`).
Dans *Settings → Pages*, la source doit être **GitHub Actions**.

## Organisation

```
index.html, chantier.html, ferme.html   pages (le monde est monté par src/entries/*)
src/kit/
  stage.js     scène, rendu « technicolour » (post-process), caméra, interface, boucle
  geo.js       matériaux et primitives (boîtes arrondies, profils extrudés…)
  parts.js     pièces mécaniques : chenilles, pneus, vérins, cabines, conducteurs
  props.js     décor : arbres, lampadaires, grange, silo, clôtures…
  tween.js     petit moteur d'animation à base de promesses
  audio.js     voix (synthèse vocale fr-FR) et bruitages (WebAudio)
src/worlds/
  chantier.js  les six engins de chantier
  ferme.js     les six machines agricoles
```

### Ajouter un monde

Un monde est un objet qui décrit :

- `data` : pour chaque machine, son nom, le verbe du bouton (« Creuser »), à quoi elle sert (`use`) et comment elle marche (`how`) ;
- `cfg` : où elle est posée sur l'île ;
- `icons` : son pictogramme SVG pour la barre du bas ;
- `build(ctx)` : construit le décor et les machines. Chaque machine définit `action()`, une suite d'étapes :

```js
await Promise.all([
  step('Les vérins font descendre le bras.', 'verins'), // phrase lue + pièce surlignée
  poseTo({ boom: -5, stick: -55 }, 1.7)                  // l'animation qui va avec
]);
```

Les vérins (`hydraulic`, `telescopic`) se recalculent seuls entre leurs deux points d'accroche : il suffit de faire bouger les pièces, les vérins suivent.

## Technique

- [three.js](https://threejs.org) r128, sans framework.
- [Vite](https://vitejs.dev) + `vite-plugin-singlefile` pour le build.
- Aucun modèle 3D externe : tout est construit en code (profils extrudés, pièces instanciées). Ça permet d'animer chaque pièce séparément.

## Idées pour la suite

- D'autres mondes : le cycle de l'eau, le corps humain, les volcans, l'espace…
- Relier chaque étape aux notions du programme (cycle 1, 2, 3…).
- Passage en SvelteKit + Threlte quand il y aura plusieurs écrans (progression, profils).
