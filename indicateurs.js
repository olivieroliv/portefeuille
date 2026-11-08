'use strict';
/* =====================================================================
   CATALOGUE DES INDICATEURS DE SMART-PORTEFEUILLE
   ---------------------------------------------------------------------
   AJOUTER UN INDICATEUR = ajouter UNE fiche au tableau ci-dessous, puis
   lancer `node outillage/tester.js` (chaque fiche y est exécutée sur un
   portefeuille fictif). Ni la macro ni le reste de la page ne changent :
   la macro collecte, la page calcule.

   Une fiche :
     id           identifiant unique, en minuscules (sert aux réglages enregistrés)
     nom          libellé affiché
     famille      'Performance' | 'Revenus et coûts' | 'Concentration' | 'Risque de marché' | …
     unite        '%' | '€' | 'nb' | 'pts' (formatage de la valeur)
     sens         'haut' : plus c'est haut, mieux c'est ; 'bas' : plus c'est bas, mieux c'est
     vert, rouge  seuils par défaut (réglables dans la page) : entre les deux, c'est « à surveiller »
     besoin       données requises : 'capture' | 'releve' | 'cours' (l'indicateur est « en attente » sinon)
     explication  une phrase : ce que mesure l'indicateur et pourquoi il compte
     calcul(ctx)  rend { valeur: nombre, detail: 'texte' } — ou { manquant: 'ce qui manque' }

   Le contexte ctx (construit par la page) :
     ctx.positions   lignes de la dernière capture : { isin, nom, ticker, dev, cours, qte, valeur (€), pru, plLat (€), plPct, fx }
     ctx.marge       { titres, cash, vl } de l'écran DEGIRO (vl = valeur nette du compte)
     ctx.k           synthèse : { vl, titres, cash, plLat, plPct, verse, gain, xirr, frais, dividendes, releve (booléen) }
     ctx.releve      { mouvements, classer(m) → type, enEuros(m) → { v, approx } | null } ou null
     ctx.cours       { serie(id) → { jours[], clotures[], devise } | null, fx(devise, jour) → unités pour 1 € | null }
     ctx.outils      fonctions de calcul communes (voir Fn_OutilsIndicateurs dans index.html) :
                     poids(), valeurPortefeuilleActuel(jours), rendements(valeurs), volatilite(rendements),
                     perteMax(valeurs), moyenne(tableau), jourIlYa(n), performanceSerie(serie, depuis)
   ===================================================================== */
const Cst_Indicateurs = [

  /* ---------- Performance ---------- */
  { id: 'xirr', nom: 'Rendement annuel (XIRR)', famille: 'Performance', unite: '%', sens: 'haut', vert: 5, rouge: 0, besoin: ['capture', 'releve'],
    explication: 'Rendement annuel de l’argent versé, en tenant compte de la date de chaque versement et retrait (en euros).',
    calcul: ctx => ctx.k.xirr == null ? { manquant: 'relevé de compte' } : { valeur: ctx.k.xirr * 100, detail: 'par an, depuis le premier versement' } },

  { id: 'gain_sur_verse', nom: 'Gain total sur l’argent versé', famille: 'Performance', unite: '%', sens: 'haut', vert: 10, rouge: 0, besoin: ['capture', 'releve'],
    explication: 'Gain total (valeur nette − versements nets) rapporté aux versements nets, sans tenir compte du temps.',
    calcul: ctx => (ctx.k.gain == null || !(ctx.k.verse > 0)) ? { manquant: 'relevé de compte' }
      : { valeur: ctx.k.gain / ctx.k.verse * 100, detail: Math.round(ctx.k.gain).toLocaleString('fr-FR') + ' € pour ' + Math.round(ctx.k.verse).toLocaleString('fr-FR') + ' € versés' } },

  { id: 'plus_value_latente', nom: 'Plus-value latente', famille: 'Performance', unite: '%', sens: 'haut', vert: 5, rouge: -5, besoin: ['capture'],
    explication: 'Gain ou perte des lignes détenues par rapport à leur prix d’achat, change compris.',
    calcul: ctx => ctx.k.plPct == null ? { manquant: 'prix de revient' } : { valeur: ctx.k.plPct, detail: Math.round(ctx.k.plLat).toLocaleString('fr-FR') + ' €' } },

  { id: 'perf_1an_vs_monde', nom: 'Performance sur 1 an face au MSCI World', famille: 'Performance', unite: 'pts', sens: 'haut', vert: 0, rouge: -10, besoin: ['capture', 'cours'],
    explication: 'Écart de performance sur un an entre le portefeuille ACTUEL (composition d’aujourd’hui, rétropolée) et l’indice mondial en euros.',
    calcul: ctx => {
      const o = ctx.outils, depuis = o.jourIlYa(365);
      const p = o.performancePortefeuille(depuis), idx = o.performanceSerie(ctx.cours.serie('IDX-IWDA'), depuis);
      if (p == null || idx == null) return { manquant: 'cours historiques' };
      return { valeur: p - idx, detail: 'portefeuille ' + p.toFixed(1) + ' % · indice ' + idx.toFixed(1) + ' %' };
    } },

  /* ---------- Revenus et coûts ---------- */
  { id: 'rendement_dividendes', nom: 'Rendement en dividendes (12 mois)', famille: 'Revenus et coûts', unite: '%', sens: 'haut', vert: 2, rouge: 0.5, besoin: ['capture', 'releve'],
    explication: 'Dividendes nets d’impôts reçus sur les douze derniers mois, rapportés à la valeur des titres.',
    calcul: ctx => {
      if (!ctx.releve) return { manquant: 'relevé de compte' };
      const depuis = ctx.outils.jourIlYa(365);
      let total = 0;
      ctx.releve.mouvements.forEach(m => {
        if (m.date < depuis) return;
        const t = ctx.releve.classer(m);
        if (t !== 'dividende' && t !== 'impot') return;
        const e = ctx.releve.enEuros(m); if (e) total += e.v;
      });
      if (!(ctx.k.titres > 0)) return { manquant: 'valeur des titres' };
      return { valeur: total / ctx.k.titres * 100, detail: Math.round(total).toLocaleString('fr-FR') + ' € nets sur 12 mois' };
    } },

  { id: 'frais_sur_verse', nom: 'Frais et taxes payés sur l’argent versé', famille: 'Revenus et coûts', unite: '%', sens: 'bas', vert: 1, rouge: 3, besoin: ['releve'],
    explication: 'Total des coûts depuis l’ouverture — frais du courtier (courtage, connexion aux places, change, ADR) et taxes sur les transactions (TTF, stamp duty) — rapporté aux versements nets.',
    calcul: ctx => (ctx.k.frais == null || !(ctx.k.verse > 0)) ? { manquant: 'relevé de compte' }
      : { valeur: (-ctx.k.frais || 0) / ctx.k.verse * 100, detail: Math.round(-ctx.k.frais || 0).toLocaleString('fr-FR') + ' € de frais et taxes' } },

  /* ---------- Concentration ---------- */
  { id: 'ligne_max', nom: 'Poids de la plus grosse ligne', famille: 'Concentration', unite: '%', sens: 'bas', vert: 15, rouge: 25, besoin: ['capture'],
    explication: 'Part de la plus grosse position dans la valeur des titres : au-delà, une seule société pèse trop sur le résultat.',
    calcul: ctx => { const p = ctx.outils.poids(); return p.length ? { valeur: p[0].poids, detail: p[0].nom } : { manquant: 'positions' }; } },

  { id: 'top5', nom: 'Poids des 5 premières lignes', famille: 'Concentration', unite: '%', sens: 'bas', vert: 50, rouge: 70, besoin: ['capture'],
    explication: 'Part des cinq plus grosses positions dans la valeur des titres.',
    calcul: ctx => { const p = ctx.outils.poids(); return p.length ? { valeur: p.slice(0, 5).reduce((s, x) => s + x.poids, 0), detail: p.slice(0, 5).map(x => x.nom).join(', ') } : { manquant: 'positions' }; } },

  { id: 'nb_effectif', nom: 'Nombre effectif de lignes', famille: 'Concentration', unite: 'nb', sens: 'haut', vert: 10, rouge: 5, besoin: ['capture'],
    explication: 'Nombre de lignes de même poids qui donneraient la même concentration (inverse de la somme des poids au carré).',
    calcul: ctx => { const p = ctx.outils.poids(); if (!p.length) return { manquant: 'positions' };
      return { valeur: 1 / p.reduce((s, x) => s + Math.pow(x.poids / 100, 2), 0), detail: p.length + ' lignes détenues' }; } },

  { id: 'hors_euro', nom: 'Part hors euro', famille: 'Concentration', unite: '%', sens: 'bas', vert: 30, rouge: 50, besoin: ['capture'],
    explication: 'Part des titres cotés dans une autre devise que l’euro : elle varie aussi avec le change.',
    calcul: ctx => { const tot = ctx.positions.reduce((s, p) => s + p.valeur, 0); if (!tot) return { manquant: 'positions' };
      const par = {}; ctx.positions.forEach(p => { if (p.dev !== 'EUR') par[p.dev] = (par[p.dev] || 0) + p.valeur; });
      const hors = Object.values(par).reduce((s, v) => s + v, 0);
      return { valeur: hors / tot * 100, detail: Object.keys(par).sort((a, b) => par[b] - par[a]).map(d => d + ' ' + (par[d] / tot * 100).toFixed(1) + ' %').join(' · ') || 'tout en euros' }; } },

  { id: 'pays_max', nom: 'Poids du premier pays', famille: 'Concentration', unite: '%', sens: 'bas', vert: 60, rouge: 80, besoin: ['capture'],
    explication: 'Part du pays le plus représenté, d’après le pays d’émission de chaque titre (deux premières lettres de l’ISIN).',
    calcul: ctx => { const tot = ctx.positions.reduce((s, p) => s + p.valeur, 0); if (!tot) return { manquant: 'positions' };
      const par = {}; ctx.positions.forEach(p => { const c = p.isin.slice(0, 2); par[c] = (par[c] || 0) + p.valeur; });
      const tri = Object.keys(par).sort((a, b) => par[b] - par[a]);
      return { valeur: par[tri[0]] / tot * 100, detail: tri.slice(0, 4).map(c => c + ' ' + (par[c] / tot * 100).toFixed(0) + ' %').join(' · ') }; } },

  { id: 'liquidites', nom: 'Part de liquidités', famille: 'Concentration', unite: '%', sens: 'bas', vert: 10, rouge: 25, besoin: ['capture'],
    explication: 'Argent non investi dans la valeur nette du compte : utile en réserve, mais il ne rapporte rien.',
    calcul: ctx => (ctx.k.cash == null || !(ctx.k.vl > 0)) ? { manquant: 'bloc de marge de la capture' } : { valeur: ctx.k.cash / ctx.k.vl * 100, detail: Math.round(ctx.k.cash).toLocaleString('fr-FR') + ' €' } },

  /* ---------- Risque de marché ---------- */
  { id: 'volatilite_1an', nom: 'Volatilité annuelle (1 an)', famille: 'Risque de marché', unite: '%', sens: 'bas', vert: 15, rouge: 25, besoin: ['capture', 'cours'],
    explication: 'Ampleur habituelle des variations du portefeuille ACTUEL sur un an (écart-type annualisé des variations quotidiennes).',
    calcul: ctx => { const o = ctx.outils, v = o.valeurPortefeuilleActuel(o.jourIlYa(365));
      if (!v || v.valeurs.length < 60) return { manquant: 'cours historiques' };
      return { valeur: o.volatilite(o.rendements(v.valeurs)) * 100, detail: v.valeurs.length + ' séances' }; } },

  { id: 'perte_max_1an', nom: 'Perte maximale (1 an)', famille: 'Risque de marché', unite: '%', sens: 'haut', vert: -15, rouge: -30, besoin: ['capture', 'cours'],
    explication: 'Plus forte baisse, d’un sommet au creux suivant, du portefeuille ACTUEL sur un an.',
    calcul: ctx => { const o = ctx.outils, v = o.valeurPortefeuilleActuel(o.jourIlYa(365));
      if (!v || v.valeurs.length < 60) return { manquant: 'cours historiques' };
      const p = o.perteMax(v.valeurs);
      return { valeur: p.perte * 100, detail: 'du ' + v.jours[p.debut] + ' au ' + v.jours[p.fin] }; } },

  { id: 'lignes_forte_perte', nom: 'Lignes en forte perte', famille: 'Risque de marché', unite: 'nb', sens: 'bas', vert: 0, rouge: 3, besoin: ['capture'],
    explication: 'Nombre de lignes à −30 % ou plus sous leur prix d’achat : chacune mérite une décision (garder, renforcer ou vendre).',
    calcul: ctx => { const l = ctx.positions.filter(p => p.plPct != null && p.plPct <= -30);
      return { valeur: l.length, detail: l.map(p => p.nom + ' ' + p.plPct.toFixed(0) + ' %').join(' · ') || 'aucune' }; } },

  { id: 'sous_mm200', nom: 'Part sous la moyenne 200 jours', famille: 'Risque de marché', unite: '%', sens: 'bas', vert: 30, rouge: 60, besoin: ['capture', 'cours'],
    explication: 'Part (en valeur) des titres dont le cours est sous sa moyenne des 200 dernières séances : signe de tendance baissière.',
    calcul: ctx => {
      let tot = 0, sous = 0, vus = 0; const noms = [];
      ctx.positions.forEach(p => {
        const s = ctx.cours.serie(p.isin); if (!s || s.clotures.length < 200) return;
        vus++; tot += p.valeur;
        const mm = ctx.outils.moyenne(s.clotures.slice(-200));
        if (s.clotures[s.clotures.length - 1] < mm) { sous += p.valeur; noms.push(p.nom); }
      });
      if (!vus) return { manquant: 'cours historiques' };
      return { valeur: sous / tot * 100, detail: noms.length ? noms.join(', ') : 'aucune' };
    } }
];
if (typeof module !== 'undefined') module.exports = { Cst_Indicateurs };
